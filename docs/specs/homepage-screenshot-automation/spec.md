# Homepage Screenshot Automation

**Jira:** SITES-43231
**Status:** Brainstorm
**Author:** Sandesh Sinha
**Date:** 2026-04-17
**Updated:** 2026-04-28

---

## Problem

Homepage screenshots for ASO customer sites have no automation today. The full pipeline is manual:

1. A developer runs `node index.js` locally (Puppeteer, Chrome + Edge)
2. Validates output with `node validate-screenshots-heuristic.js`
3. Uploads to SharePoint manually.
4. Screenshots are served from `https://main--experience-success-studio-demo--hlxscreens.aem.live/content/{siteId}.jpeg`

**What's at risk:** Screenshots go stale indefinitely. A site redesign or domain change is never reflected. There is no fallback when a capture fails — the stale image is silently served. Scaling to hundreds of sites makes the manual process completely untenable.

At the same time, `spacecat-content-scraper` already runs Puppeteer at scale in AWS Lambda, takes `fullpage` + `thumbnail` screenshots, and stores them in S3 (`scrapes/{jobId}/screenshot-{device}-{type}.png`). The consent-banner audit in `spacecat-api-service/src/controllers/consentBanner.js` demonstrates the end-to-end pattern for triggering a scrape job and serving results via presigned URL — this is directly reusable.

---

## Proposal

Reuse `spacecat-content-scraper` (`full-page` processingType) for capture, port the heuristic validator into `spacecat-audit-worker`, then upload validated screenshots to SharePoint via MS Graph so the existing `aem.live` CDN URL is unchanged — no breaking change to consumers. Manual overrides write to the same SharePoint location via the backoffice. CloudFront migration is deferred to Phase 2.

```
Scheduler (weekly, ASO-entitled sites only)
    │  per-site Configuration check: skip if `screenshot` audit is disabled for this site
    ▼
spacecat-audit-worker — new `screenshot` audit type
    │  ScrapeClient.createScrapeJob({ processingType: 'full-page', jobId: siteId, urls: [baseURL] })
    ▼
spacecat-scrape-job-manager → spacecat-content-scraper (FullPageHandler)
    │
    ▼  Stores raw capture to S3_SCRAPER_BUCKET:
    │    scrapes/{siteId}/screenshot-desktop-fullpage.png
    │    scrapes/{siteId}/screenshot-desktop-thumbnail.png
    ▼
spacecat-audit-worker — heuristic validator (no AI)
    │  pass → upload validated PNG (re-encoded JPEG) to SharePoint approved/{siteId}.jpeg via MS Graph
    │  fail → log structured error + emit metric `screenshot.validation.failed{reason}`
    ▼
GET /sites/:siteId/screenshot  (spacecat-api-service)
    │  Returns deterministic aem.live URL: https://main--…aem.live/content/{siteId}.jpeg
    │  Consumer/CDN sees 404 if not yet published; API itself does not gate on existence.
    ▼
experience-success-studio-backoffice — Screenshots page
    │  View current screenshot via aem.live URL
    │  Upload override → API streams to SharePoint approved/{siteId}.jpeg via MS Graph
    │                    AND disables `screenshot` audit for this siteId in Configuration
    │                    (auto runs no longer overwrite the override)
    └─ Delete override → API deletes SharePoint file
                         AND re-enables `screenshot` audit for this siteId
                         (next weekly auto run re-publishes if validation passes)
```

**Storage map:**

| Purpose | Location |
|---|---|
| Raw capture (fullpage / thumbnail) | S3: `scrapes/{siteId}/screenshot-desktop-{type}.png` |
| Published screenshot (auto + override share path) | SharePoint: `approved/{siteId}.jpeg`, served by `aem.live` CDN |
| Per-site override flag (lock) | `Configuration.handlers.screenshot.disabledForSites` (existing audit-skip mechanism) |

Bucket: `process.env.S3_SCRAPER_BUCKET` (already wired) — used only for raw scraper output. No `screenshots/` prefix is created. SharePoint upload uses MS Graph via existing platform credentials.

**Override semantics.** Overrides and auto-published captures share the same SharePoint path (`approved/{siteId}.jpeg`). Uploading an override does two things atomically: (1) overwrites the SharePoint file, (2) disables the `screenshot` audit for that siteId in `Configuration` so subsequent weekly runs skip the site. Deleting an override reverses both: removes the SharePoint file and re-enables the audit. The `Configuration` flag is the single source of truth for "is this site overridden?" — no shadow state in S3.

**Where do failures show up?** The validator emits `screenshot.validation.failed{reason}` metrics and structured logs on every rejection. Failure visibility lives in CloudWatch / metrics dashboards, not in the API or backoffice. If a screenshot is missing, the admin's recourse is to upload an override; they don't need an in-product rejection reason to act.

### Rejected: Manual Review / GitHub Actions Workflow

An earlier alternative proposed running the existing `site-screenshot` scripts in GitHub Actions, uploading to a SharePoint `pending/` folder, and requiring backoffice approval before publishing to `approved/`. Rejected because:

- The scraper Lambda is already team-maintained, scaled, and observable; GitHub Actions duplicates that for no benefit.
- A required manual review gate per site does not scale to hundreds of ASO sites — the validator should auto-publish on pass and only escalate failures.
- MS Graph token rotation in a cron-only GitHub workflow has worse operational ergonomics than calling MS Graph from Lambda where credentials are already managed.

We keep the SharePoint serving layer (no breaking change for consumers) but drop the manual-review workflow.

### Rejected: Option C — DRS (`llmo-data-retrieval-service`) as a Screenshot Provider

DRS was considered as a third option since it already has a provider-adapter framework, S3 result storage, a scheduler, and SharePoint distribution. Rejected for the following reasons:

1. **Domain mismatch.** DRS is purpose-built for "query an LLM provider, return structured JSON, run brand-presence analysis, emit Excel." Its `ProviderAdapter` contract (`execute_sync` / `execute_async` / `poll_async_status`) returns JSON results that flow into the Brand Presence Fargate pipeline. A screenshot has no LLM output and no brand-mention payload — it would be a non-conforming citizen of the pipeline.
2. **Duplicates `spacecat-content-scraper`.** The scraper already runs Puppeteer at scale in Lambda, dismisses consent banners, and writes `scrapes/{jobId}/screenshot-desktop-fullpage.png` — exactly what this spec needs. Adding a Puppeteer provider in DRS reinvents that infrastructure outside the team that owns it.
3. **Compute model is wrong.** DRS Fargate is gated behind a `BRAND_PRESENCE_WHITELIST` due to VPC/IGW limits in dev; Lambda Puppeteer in DRS has known architecture pitfalls (x86_64 mismatch, native-binary issues). The scraper's Lambda fleet is already tuned for Puppeteer.
4. **Wrong consumer surface.** The screenshot's consumer is the backoffice UI loading a CDN URL. It does not need DRS's job model, SQS fan-out, SNS `JOB_COMPLETED` event, brand-presence analysis, or Excel distribution. Routing a binary PNG through that pipeline adds latency and operational surface for zero benefit.
5. **Ownership.** Screenshot capture belongs with the content-scraping team that owns `spacecat-content-scraper`, not with the LLM-data team that owns DRS. Aligning code ownership with infrastructure ownership keeps on-call scope coherent.

DRS *would* be the right home if the requirement evolved into "capture homepage → run an LLM-powered visual analysis on it" (e.g., visual brand audit, OCR-based mention extraction). For capturing, validating, and publishing a PNG, the scraper-based pipeline is strictly simpler.

---

## Implementation

### Phase 1 — Automated Capture + SharePoint Delivery (This ticket)

#### Step 1: New `screenshot` audit type — `spacecat-audit-worker`

Add `src/screenshot/handler.js`:

```js
import { Audit } from '@adobe/spacecat-shared-data-access';
import { AuditBuilder } from '../common/audit-builder.js';
import { wwwUrlResolver } from '../common/index.js';

const { AUDIT_STEP_DESTINATIONS } = Audit;

export async function captureScreenshot(context) {
  const { site } = context;
  return {
    type: 'full-page',
    siteId: site.getId(),  // jobId = siteId makes S3 key predictable
    allowCache: false,
  };
}

export default new AuditBuilder()
  .withUrlResolver(wwwUrlResolver)
  .addStep('captureScreenshot', captureScreenshot, AUDIT_STEP_DESTINATIONS.SCRAPE_CLIENT)
  .build();
```

Register in the audit type map (same pattern as `cwv`). A lightweight completion step (Step 1.5) runs the heuristic validator before the API will serve the screenshot.

**Capture → publish split.** The `FullPageHandler` writes to `scrapes/{siteId}/screenshot-desktop-fullpage.png` (the *capture* in S3). The validator publishes accepted captures by uploading them to SharePoint `approved/{siteId}.jpeg` via MS Graph (re-encoding PNG → JPEG to match the existing `aem.live` URL). No state is written back to S3 — the publish is the publish. The API never inspects S3 or SharePoint to answer `GET /sites/:siteId/screenshot`; it returns a deterministic `aem.live` URL based on `siteId` alone.

**Override = audit skip.** Before triggering a scrape, the handler checks the site's `Configuration` for the `screenshot` audit. If the site is disabled (because an admin uploaded an override), the audit short-circuits without enqueuing a scrape job. This is the same per-site enable/disable mechanism used by other audit types (e.g., `cwv`); we reuse it rather than introducing a new lock primitive.

#### Step 1.5: Heuristic Screenshot Validator (no AI)

A classical, deterministic validator runs on every capture before it is published to SharePoint. The current manual flow already uses `validate-screenshots-heuristic.js` in the `site-screenshot` repo — port that logic into `spacecat-audit-worker` as a completion handler so we get the same signal automatically.

**Why no AI?** Determinism, cost, latency, and explainability. Heuristics give a binary pass/fail with named failure reasons we can emit as structured logs and CloudWatch metric dimensions. An AI judge would be a black box for what is fundamentally a "did the page render" check.

**Pipeline placement:**

```
FullPageHandler writes scrapes/{siteId}/screenshot-desktop-fullpage.png
    │
    ▼
spacecat-audit-worker — screenshot completion handler (SQS-triggered on scrape complete)
    │  download PNG → run validator → emit { valid, reasons[], stats{} }
    ├─ valid:   re-encode PNG → JPEG; PUT to SharePoint approved/{siteId}.jpeg via MS Graph
    └─ invalid: log structured error { siteId, reasons, stats, capturedAt };
                emit metric `screenshot.validation.failed{reason}` (one dimension per failed check)
                — visibility lives in CloudWatch / dashboards, not S3
```

**Heuristic checks** (all pure pixel/file statistics — no model inference):

| Check | Signal | Threshold (initial) | Catches |
|---|---|---|---|
| File size | `bytes(png)` | ≥ 20 KB and ≤ 8 MB | Empty/aborted captures; runaway full-page renders |
| Dimensions | `width × height` | width ≥ 1024, height ≥ 768 | Truncated viewport, sub-fold captures |
| Mean luminance | average pixel brightness | between 12 and 245 (0–255 scale) | All-black (CSP failure) and all-white (blank document) pages |
| Color variance | stddev of luminance across sampled grid | ≥ 8 | Solid-color screens, single-frame error pages |
| Unique colors (sampled) | `count(distinct(quantized RGB))` over a 64×64 grid | ≥ 64 | "Loading…" spinner pages, blank shells |
| Edge density (Sobel sample) | proportion of pixels with gradient > τ | ≥ 0.02 | Pages with no rendered content / no text or imagery |
| Text-row signature | count of horizontal pixel rows with high horizontal-gradient variance | ≥ 6 | Catches renders that look colorful but contain no actual text rows |
| Top-band hash | perceptual hash of the top 200px | not in `KNOWN_BAD_HASHES` set | "Site can't be reached", Cloudflare challenge, default browser error pages |

Implementation notes:
- Use `sharp` (already a transitive dep via Puppeteer chains) for decode + resize + raw pixel buffer access. No native deps beyond what the scraper layer already ships.
- Validator is a pure function `validate(buffer): { valid: boolean, reasons: string[], stats: object }` so it is unit-testable from fixture PNGs without invoking S3.
- `KNOWN_BAD_HASHES` lives in a small JSON file checked into the repo (curated from observed failures); it is updated via PR, not at runtime.
- All thresholds are configurable via env (`SCREENSHOT_MIN_BYTES`, `SCREENSHOT_MIN_EDGE_DENSITY`, etc.) so we can tune without redeploying logic.
- Validator must run in well under the Lambda timeout for an 8 MB PNG; budget 5 s p99.

**Test fixtures** (in `spacecat-audit-worker/test/fixtures/screenshots/`):
- `valid-homepage.png`, `valid-dark-mode.png` — should pass
- `blank-white.png`, `blank-black.png`, `loading-spinner.png`, `cf-challenge.png`, `tiny-truncated.png` — each fails exactly one heuristic, asserted by `reasons[]`

#### Step 1.6: Serving — Reuse the Existing aem.live CDN

Phase 1 reuses the existing serving substrate: validated screenshots are uploaded to SharePoint at `approved/{siteId}.jpeg` via MS Graph; the existing AEM Edge Delivery host (`https://main--experience-success-studio-demo--hlxscreens.aem.live/content/{siteId}.jpeg`) serves them. Consumers continue to fetch the same URL — no breaking change.

**Why this and not new infra.** The aem.live CDN already exists, already serves these screenshots, and is already what every consumer points at. Standing up a CloudFront distribution + OAC + private S3 in Phase 1 buys us nothing the existing CDN doesn't already provide and forces a coordinated consumer migration. The right time to migrate serving is when we have a concrete reason to leave SharePoint (see Phase 2).

**MS Graph upload contract.**

```
PUT /drives/{driveId}/items/{folderId}:/{siteId}.jpeg:/content   ← content upload
    Content-Type: image/jpeg
    body: <validated, re-encoded JPEG buffer>
```

- Reuse the existing platform MS Graph credential pattern; do not introduce a new app registration if one already covers the SharePoint site.
- Drive ID and parent folder ID for `approved/` are configured via env (`SHAREPOINT_DRIVE_ID`, `SHAREPOINT_APPROVED_FOLDER_ID`).
- Both the auto-publish (validator completion handler) and the override-upload API path call the same `publishToSharePoint(siteId, buffer)` helper.

**Why JPEG re-encode.** The existing aem.live URL ends in `.jpeg`. Re-encoding PNG→JPEG at quality ~85 cuts size by ~5–10× for typical homepages, which keeps the SharePoint upload fast and the CDN payload small. Use `sharp` (already required for the validator) for both the validation read and the JPEG encode in a single pipeline.

**API behavior.** `GET /sites/:siteId/screenshot` does not call MS Graph or S3 on the read path — it returns the deterministic aem.live URL constructed from `siteId` alone. See Step 2 for the controller.

#### Step 2: Screenshot API endpoints — `spacecat-api-service`

Add `src/controllers/screenshot.js` (modeled on `src/controllers/consentBanner.js`):

```js
// GET /sites/:siteId/screenshot
// Returns the deterministic aem.live URL. The API does not check whether the
// SharePoint file exists — the consumer's image fetch surfaces 404 if not yet published.
export async function getScreenshot(ctx) {
  const { siteId } = ctx.params;
  const cdnBase = ctx.env.SCREENSHOT_AEM_LIVE_BASE; // https://main--experience-success-studio-demo--hlxscreens.aem.live/content
  return ok({ url: `${cdnBase}/${siteId}.jpeg` });
}

// POST /sites/:siteId/screenshot/override
// 1. Stream multipart JPEG to SharePoint approved/{siteId}.jpeg via MS Graph.
// 2. Disable the `screenshot` audit for this siteId in Configuration so weekly
//    runs no longer overwrite the override.
export async function uploadOverride(ctx) {
  const { siteId } = ctx.params;
  await publishToSharePoint(ctx, siteId, ctx.body); // multipart -> MS Graph PUT
  await disableAuditForSite(ctx, 'screenshot', siteId);
  return ok({ url: `${ctx.env.SCREENSHOT_AEM_LIVE_BASE}/${siteId}.jpeg` });
}

// DELETE /sites/:siteId/screenshot/override
// 1. Delete SharePoint approved/{siteId}.jpeg via MS Graph.
// 2. Re-enable the `screenshot` audit for this siteId in Configuration so the
//    next weekly run re-publishes if validation passes.
export async function deleteOverride(ctx) {
  const { siteId } = ctx.params;
  await deleteFromSharePoint(ctx, siteId);
  await enableAuditForSite(ctx, 'screenshot', siteId);
  return noContent();
}
```

`disableAuditForSite` / `enableAuditForSite` use the existing per-site audit-skip surface on the `Configuration` model in `spacecat-shared-data-access` — the same mechanism that gates `cwv` per site.

Register routes in `src/routes/index.js`:
```js
'GET /sites/:siteId/screenshot':                getScreenshot,
'POST /sites/:siteId/screenshot/override':      uploadOverride,
'DELETE /sites/:siteId/screenshot/override':    deleteOverride,
```

Auth: `getScreenshot` — authenticated (scoped to org); override endpoints — `hasAdminAccess()`.

The override endpoint accepts the upload as `multipart/form-data` and streams it directly to MS Graph rather than minting a presigned URL — this avoids exposing a SharePoint write surface to the browser and keeps MS Graph credentials server-side.

#### Step 3: Backoffice Screenshots page — `experience-success-studio-backoffice`

New files (follow `Reports.js` + `ReportDetails.js` patterns):

```
src/dx-excshell-1/web-src/src/components/
  Screenshots.js        ← list view: site table with status badge + thumbnail
  ScreenshotDetails.js  ← detail: full image, upload override, delete override
```

Add route in `App.js`:
```js
<Route path='/sites/:siteId/screenshots' element={<Screenshots />} />
```

**Screenshots.js** features:
- `TableView` (React Spectrum) with columns: Site URL, Thumbnail, Override (yes/no)
- "Override" column reads from the site's `Configuration` (audit disabled for `screenshot` ⇒ override active)
- Actions: View, Upload Override, Delete Override
- `useAsyncList` for data loading — follows `Reports.js` pattern

**ScreenshotDetails.js** features:
- Full image via the `aem.live` URL returned by `GET /sites/:siteId/screenshot`
- Image element falls back to a "no screenshot yet" state on `onError` (404 from CDN before first publish)
- "Upload Override": file picker → `POST .../override` with `multipart/form-data` body → API forwards to SharePoint and disables the audit
- "Delete Override": `DELETE .../override` with `ConfirmationDialog` — confirmation copy notes the next weekly run will re-publish
- `ToastQueue` notifications on success/failure

Add to `apiService.js`:
```js
export const getScreenshotUrl = (ims, siteId) =>
  fetchAPI(ims, `sites/${siteId}/screenshot`);
export const uploadScreenshotOverride = (ims, siteId, file) => {
  const fd = new FormData(); fd.append('file', file);
  return fetchAPI(ims, `sites/${siteId}/screenshot/override`, { method: 'POST', body: fd });
};
export const deleteScreenshotOverride = (ims, siteId) =>
  fetchAPI(ims, `sites/${siteId}/screenshot/override`, { method: 'DELETE' });
```

Add "Screenshots" nav link in `SitesList.js` alongside existing "Opportunities" / "Reports" links.

#### Step 4: Scheduler registration

Enable the `screenshot` audit type in SpaceCat scheduler config:
- Cadence: `every-sunday` (weekly)
- Entitlement gate: `Entitlement.PRODUCT_CODES.ASO`
- Mechanism: same `registerAudit()` call used for `cwv` and `cwv-trends-audit`

### Phase 2 — Migrate Serving to CloudFront + S3 (Optional)

Phase 1 reuses the `aem.live` CDN, which means SharePoint is on the publish path forever — with MS Graph token rotation, throttling limits, and a control plane outside our AWS account. Migrate to a CloudFront + private S3 distribution when one of these forces it:

- We need direct cache-invalidation control (e.g., to push a fix to a stale screenshot in seconds rather than waiting on Edge Delivery).
- MS Graph throttling becomes a publish-rate ceiling as the site count grows.
- A consumer requires a non-`aem.live` URL (different domain, different auth model, etc.).

**Target architecture.**

```
CloudFront distribution (screenshots.spacecat.adobe.com)
    │  cache: max-age=3600 (1 hour)
    │  OAC (Origin Access Control) → S3
    ▼
S3 bucket (private, OAC-only — no public ACLs, no website hosting)
    └── screenshots/auto/{siteId}.png        ← stable key, overwritten by validator
        screenshots/overrides/{siteId}.png   ← stable key, overwritten by upload
```

**Why this shape.** Stable per-site keys + a 1-hour edge TTL match the publish cadence (weekly auto, occasional overrides). On override writes, the API issues a single-key `CreateInvalidation` so admins see their change immediately (CloudFront's first 1000 invalidations/month are free). Auth is anonymous CDN-side: the bucket is private (OAC only), and the `siteId` UUID in the path is unguessable, which protects the customer-list privacy concern — homepage screenshot pixels themselves are public. If compliance later forbids pre-auth access, swap in CloudFront signed URLs (per-request) without restructuring the storage.

**Migration plan.**

1. Stand up CloudFront + S3 alongside SharePoint publishing — validator dual-writes (`PUT` to S3, `PUT` to SharePoint) for one full weekly cycle so the new path is exercised end-to-end.
2. Update `GET /sites/:siteId/screenshot` to return the CloudFront URL (`https://${SCREENSHOT_CDN_HOST}/screenshots/{auto|override}/${siteId}.png`) behind a feature flag; backoffice flips first.
3. Notify any external consumers of the URL change with a deprecation window.
4. Drop SharePoint publishing from the validator; remove MS Graph dependency from the API service.

**What stays from Phase 1.** The audit type, validator, override-disables-audit semantics, and `Configuration` skip flag are all unchanged — only the publish target (SharePoint → S3) and serving host (`aem.live` → CloudFront) move. The CloudFront design uses two stable keys (`screenshots/auto/{siteId}.png` and `screenshots/overrides/{siteId}.png`); the API picks which to return based on whether the audit is currently disabled for the site (override active) or enabled (auto). Still no per-site state in S3 — the `Configuration` flag remains the source of truth.

---

## Rollout Strategy

**Phase 1:**
1. Deploy `spacecat-audit-worker` with new `screenshot` audit type — scheduler not yet enabled.
2. Manually trigger a `screenshot` audit job for 5–10 test sites via the API; verify the raw capture lands in S3, the validator runs, and the JPEG is published to SharePoint `approved/{siteId}.jpeg`.
3. Confirm the existing `aem.live` URL serves the new image for those test siteIds.
4. Deploy `spacecat-api-service` screenshot endpoints; verify `GET /sites/:siteId/screenshot` returns the `aem.live` URL.
5. Deploy backoffice Screenshots page; test override upload + delete end-to-end. Verify upload sets the audit-disabled flag in `Configuration` and the next audit run skips that site; verify delete clears the flag and the next run re-publishes.
6. Confirm CloudWatch metric `screenshot.validation.failed` is emitted on a deliberately bad capture (e.g., a non-existent URL).
7. Enable scheduler for all ASO sites.

**Rollback:** Disable the `screenshot` audit type in scheduler config. The validator stops publishing; existing SharePoint files stay in place (and continue to serve via `aem.live`) so consumers see the last good state. The `Configuration` skip flag is per-site state on existing entities — no separate cleanup needed; if reverting fully, an admin can clear `handlers.screenshot.disabledForSites` via the existing config-management surface.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scraper fails for sites with bot protection | Medium | Medium | Existing stealth plugin + bot detection in scraper; failed scrapes → SharePoint not updated → admin uploads override (which also disables the audit until they delete it) |
| S3 key format changes in `spacecat-content-scraper` | Low | High | Pin scraper version; add integration test that asserts key path; document the convention |
| MS Graph throttling on bulk weekly publish | Medium | Medium | Spread publishes across the weekly window; respect `Retry-After`; one upload per site is well under SharePoint per-app throttle limits |
| MS Graph token expiry / rotation drift | Low | Medium | Reuse existing platform token-refresh pattern; alert on `401`/`403` from publish path; CloudWatch metric on publish failures |
| Override deleted but next weekly run still days away | Medium | Low | Backoffice surfaces this in the delete confirmation; admin can also manually trigger an audit run if they need an immediate refresh |
| Validator failure goes unnoticed (no UI surface) | Medium | Low | CloudWatch alarm on `screenshot.validation.failed` rate exceeding baseline; admin investigates via dashboards and uploads override |
| Weekly scrape load on scraper fleet | Low | Low | 1 URL per site, same queue as other audits; scraper handles bursts via FIFO concurrency |

---

## Open Questions

1. Should the `screenshot` audit type be gated on `ASO` entitlement only, or also `ACO`/`LLMO`?
2. Should raw S3 captures (`scrapes/{siteId}/screenshot-desktop-*.png`) be TTL-expired (e.g. after 30 days), or kept indefinitely for debugging?
3. What device should be canonical for the homepage screenshot — desktop only, or also a mobile companion at `approved/{siteId}-mobile.jpeg`?
4. Does the scraper's `FullPageHandler` need option tweaks for homepage capture (e.g. `rejectRedirects: false` since homepages often redirect `www` → non-www)?
5. Which existing platform component owns the MS Graph credential / token refresh that we should reuse (vs. provisioning a new one)?
6. What concrete trigger moves us from Phase 1 (SharePoint) to Phase 2 (CloudFront) — site-count threshold, throttling incident, or a planned migration window?
7. Is the existing `Configuration.handlers.<auditType>` skip surface the right field for the override lock, or do we need a dedicated flag (e.g. `Configuration.handlers.screenshot.overrideActive: [siteId]`) to keep "admin disabled audit" distinct from "override active"?

---

## Resolved Questions

1. **Where are screenshots stored today?** Manual SharePoint upload, served via AEM Edge Delivery (`aem.live`). No S3 involvement in current flow.
2. **Does CWV audit capture screenshots?** No — CWV reads from RUM API only. `spacecat-content-scraper` is the screenshot source.
3. **What S3 key does the scraper use?** `scrapes/{jobId}/{importPath}/screenshot-{device}-{type}.png`. Setting `jobId = siteId` makes the path predictable.
4. **Is there an existing approve/reject UI pattern in the backoffice?** Yes — `OpportunityDetails.js` has `APPROVED`/`SKIPPED`/`FIXED` suggestion status flow; `ConfirmationDialog.js` handles destructive confirmations.
5. **What triggers consent-banner screenshots today?** `POST /consent-banner` in `spacecat-api-service` calls `ScrapeClient.createScrapeJob()` — this is the exact template to reuse.
6. **Should Phase 1 keep the `aem.live` serving URL or move serving to a new CDN?** Keep `aem.live` for Phase 1 to avoid breaking consumers and standing up new infra. CloudFront + S3 is the Phase 2 target, triggered by a concrete need (MS Graph throttling, invalidation control, or non-`aem.live` consumer requirement).

---

## Dependent Repositories

| Repository | Change | Notes |
|---|---|---|
| `spacecat-audit-worker` | New `screenshot` audit type + validator + SharePoint publish step | Uses existing `SCRAPE_CLIENT` step destination; new MS Graph upload helper |
| `spacecat-api-service` | 3 new screenshot endpoints (multipart override upload) | Reuses `S3_SCRAPER_BUCKET`, `consentBanner.js` pattern; calls MS Graph for override write/delete |
| `experience-success-studio-backoffice` | New Screenshots page | Reuses `Reports.js` + `ReportDetails.js` patterns |
| `site-screenshot` | Decommission once Phase 1 ships | Existing manual scripts become redundant; keep the validator logic that ports into `spacecat-audit-worker` |

---

## Review Feedback Log

| Date | Reviewer | Finding | Disposition |
|---|---|---|---|
| | | | |
