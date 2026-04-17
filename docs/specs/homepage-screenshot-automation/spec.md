# Homepage Screenshot Automation

**Jira:** SITES-43231
**Status:** Brainstorm
**Author:** Sandesh Sinha
**Date:** 2026-04-17
**Updated:** 2026-04-17

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

Two approaches are viable. **Option A is recommended.**

### Option A — SpaceCat Content Scraper Pipeline (Recommended)

Reuse the existing `spacecat-content-scraper` (`full-page` processingType) as the capture engine. Add a new `screenshot` audit type to `spacecat-audit-worker` that triggers a scrape job. Expose the result via a new API endpoint in `spacecat-api-service`. For failures, an admin uploads a manual override via `experience-success-studio-backoffice`, stored at a separate S3 prefix that takes precedence.

```
Scheduler (weekly, ASO-entitled sites only)
    │
    ▼
spacecat-audit-worker — new `screenshot` audit type
    │  ScrapeClient.createScrapeJob({ processingType: 'full-page', jobId: siteId, urls: [baseURL] })
    ▼
spacecat-scrape-job-manager → spacecat-content-scraper (FullPageHandler)
    │
    ▼  Stores to S3_SCRAPER_BUCKET:
    │    scrapes/{siteId}/screenshot-desktop-fullpage.png
    │    scrapes/{siteId}/screenshot-desktop-thumbnail.png
    ▼
GET /sites/:siteId/screenshot  (spacecat-api-service)
    │  1. Check override:  screenshots/overrides/{siteId}.png  ← manual upload via backoffice
    │  2. Check auto:      scrapes/{siteId}/screenshot-desktop-fullpage.png
    │  3. Return presigned URL (7-day TTL) or 404
    ▼
experience-success-studio-backoffice — Screenshots page
    │  View current screenshot (auto or override)
    │  Upload override (presigned PUT URL)
    └─ Delete override (fall back to auto)
```

**S3 key paths:**

| Purpose | Key |
|---|---|
| Auto-captured fullpage | `scrapes/{siteId}/screenshot-desktop-fullpage.png` |
| Auto-captured thumbnail | `scrapes/{siteId}/screenshot-desktop-thumbnail.png` |
| Manual override | `screenshots/overrides/{siteId}.png` |

Bucket: `process.env.S3_SCRAPER_BUCKET` (already wired in `spacecat-api-service`).

### Option B — SharePoint Automation (Keep aem.live CDN)

Automate the current pipeline via GitHub Actions. Capture → heuristic-validate → upload to a SharePoint `pending/` folder. Admin reviews in `experience-success-studio-backoffice` and approves. Approval triggers an MS Graph API move from `pending/` to `approved/`, which the `aem.live` CDN serves.

| | Option A | Option B |
|---|---|---|
| Screenshot infra | Existing Lambda scraper (team-maintained) | GitHub Actions + local Puppeteer |
| Human review step | Override only (on failure) | Required before publish |
| Serving URL | New: `GET /sites/:siteId/screenshot` | Existing: `aem.live/content/{siteId}.jpeg` |
| Breaking change | Yes — consumers must update to new URL | No |
| Maintenance cost | Low | Medium (GH Actions + MSGraph token rotation) |
| Screenshot quality | Good (consent banners dismissed by scraper) | Better (heuristic validator) |

Option B is preferred only if backwards compatibility of the `aem.live` serving URL is a hard requirement.

---

## Implementation

### Phase 1 — Option A Core (This ticket)

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

Register in the audit type map (same pattern as `cwv`). No completion SQS handler needed — the S3 key is fully deterministic from `siteId`.

**Why no completion handler?** The `FullPageHandler` stores the screenshot at `scrapes/{jobId}/screenshot-desktop-fullpage.png`. By passing `jobId = siteId`, the API can construct the key directly and check with a `HeadObject` call. This avoids a DynamoDB model just for screenshot state.

#### Step 2: Screenshot API endpoints — `spacecat-api-service`

Add `src/controllers/screenshot.js` (modeled on `src/controllers/consentBanner.js`):

```js
// GET /sites/:siteId/screenshot
export async function getScreenshot(ctx) {
  const { siteId } = ctx.params;
  const bucket = ctx.env.S3_SCRAPER_BUCKET;

  for (const key of [
    `screenshots/overrides/${siteId}.png`,
    `scrapes/${siteId}/screenshot-desktop-fullpage.png`,
  ]) {
    if (await objectExists(ctx.s3Client, bucket, key)) {
      const url = await getSignedUrl(ctx.s3Client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: 604800 }
      );
      return ok({ url, source: key.startsWith('screenshots/overrides') ? 'override' : 'auto' });
    }
  }
  return notFound('No screenshot available for this site');
}

// POST /sites/:siteId/screenshot/override
// Returns a presigned PUT URL so the backoffice can upload directly to S3
export async function getOverrideUploadUrl(ctx) { ... }

// DELETE /sites/:siteId/screenshot/override
export async function deleteOverride(ctx) { ... }
```

Register routes in `src/routes/index.js`:
```js
'GET /sites/:siteId/screenshot':                getScreenshot,
'POST /sites/:siteId/screenshot/override':      getOverrideUploadUrl,
'DELETE /sites/:siteId/screenshot/override':    deleteOverride,
```

Auth: `getScreenshot` — authenticated (scoped to org); override endpoints — `hasAdminAccess()`.

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
- `TableView` (React Spectrum) with columns: Site URL, Source (Auto/Override), Thumbnail, Last Updated
- Status badge: Auto (green) / Override (blue) / Missing (red)
- Actions: View, Upload Override, Delete Override
- `useAsyncList` for data loading — follows `Reports.js` pattern

**ScreenshotDetails.js** features:
- Full image via presigned URL (same pattern as `ReportDetails.js`)
- "Upload Override": `POST .../override` → file picker → browser `PUT` to presigned URL
- "Delete Override": `DELETE .../override` with `ConfirmationDialog`
- `ToastQueue` notifications on success/failure

Add to `apiService.js`:
```js
export const getScreenshotUrl = (ims, siteId) =>
  fetchAPI(ims, `sites/${siteId}/screenshot`);
export const getScreenshotOverrideUploadUrl = (ims, siteId) =>
  fetchAPI(ims, `sites/${siteId}/screenshot/override`, { method: 'POST' });
export const deleteScreenshotOverride = (ims, siteId) =>
  fetchAPI(ims, `sites/${siteId}/screenshot/override`, { method: 'DELETE' });
```

Add "Screenshots" nav link in `SitesList.js` alongside existing "Opportunities" / "Reports" links.

#### Step 4: Scheduler registration

Enable the `screenshot` audit type in SpaceCat scheduler config:
- Cadence: `every-sunday` (weekly)
- Entitlement gate: `Entitlement.PRODUCT_CODES.ASO`
- Mechanism: same `registerAudit()` call used for `cwv` and `cwv-trends-audit`

### Phase 2 — Option B (If aem.live URL backwards-compat is required)

1. Add `.github/workflows/screenshot-automation.yml` in `site-screenshot` repo:
   - Weekly cron trigger (`workflow_dispatch` for manual runs)
   - Steps: `node index.js --chrome-only` → `node validate-screenshots-heuristic.js` → upload to SharePoint `pending/` via MS Graph
2. Add `PATCH /sites/:siteId/screenshot { action: 'approve' | 'reject' }` to `spacecat-api-service` — proxies MS Graph API to move file between `pending/` and `approved/` folders
3. Same backoffice Screenshots page as Phase 1, but approve/reject calls PATCH endpoint instead of managing S3 directly

---

## Rollout Strategy

**Option A:**
1. Deploy `spacecat-audit-worker` with new `screenshot` type — scheduler not yet enabled
2. Manually trigger a `screenshot` audit job for 5–10 test sites via the API; verify S3 keys are populated
3. Deploy `spacecat-api-service` screenshot endpoints; verify `GET /sites/:siteId/screenshot` returns presigned URLs
4. Deploy backoffice Screenshots page; test override upload + delete flow end-to-end
5. Enable scheduler for all ASO sites

**Rollback:** Disable the `screenshot` audit type in scheduler config. No data is mutated — S3 objects accumulate passively. API endpoints return 404 if S3 has no screenshot; no user-visible breakage.

**Option B rollback:** Disable the GitHub Actions schedule. SharePoint `pending/` folder stays untouched; no files are pushed to `approved/` without manual approval, so aem.live CDN is never affected.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scraper fails for sites with bot protection | Medium | Medium | Existing stealth plugin + bot detection in scraper; failed scrapes → S3 key absent → API returns 404 → admin uploads override |
| S3 key format changes in `spacecat-content-scraper` | Low | High | Pin scraper version; add integration test that asserts key path; document the convention |
| Option A breaking change on serving URL | High | Medium | Communicate to all consumers before enabling scheduler; maintain a redirect or alias for 90 days |
| S3_SCRAPER_BUCKET IAM permissions missing for override prefix | Low | Low | Add `screenshots/overrides/*` to existing bucket policy alongside `scrapes/*` |
| Weekly scrape load on scraper fleet | Low | Low | 1 URL per site, same queue as other audits; scraper handles bursts via FIFO concurrency |

---

## Open Questions

1. Is the `aem.live` serving URL actively consumed by any external service or partner? This determines whether Option A's URL change is acceptable or Option B is required.
2. Should the `screenshot` audit type be gated on `ASO` entitlement only, or also `ACO`/`LLMO`?
3. Should old auto-captured screenshots in S3 be TTL-expired (e.g. after 30 days), or kept indefinitely?
4. What device should be canonical for the homepage screenshot — desktop only, or also mobile thumbnail?
5. Does the scraper's `FullPageHandler` need any option tweaks for homepage capture (e.g. `rejectRedirects: false` since homepages often redirect `www` → non-www)?

---

## Resolved Questions

1. **Where are screenshots stored today?** Manual SharePoint upload, served via AEM Edge Delivery (`aem.live`). No S3 involvement in current flow.
2. **Does CWV audit capture screenshots?** No — CWV reads from RUM API only. `spacecat-content-scraper` is the screenshot source.
3. **What S3 key does the scraper use?** `scrapes/{jobId}/{importPath}/screenshot-{device}-{type}.png`. Setting `jobId = siteId` makes the path predictable.
4. **Is there an existing approve/reject UI pattern in the backoffice?** Yes — `OpportunityDetails.js` has `APPROVED`/`SKIPPED`/`FIXED` suggestion status flow; `ConfirmationDialog.js` handles destructive confirmations.
5. **What triggers consent-banner screenshots today?** `POST /consent-banner` in `spacecat-api-service` calls `ScrapeClient.createScrapeJob()` — this is the exact template to reuse.

---

## Dependent Repositories

| Repository | Change | Notes |
|---|---|---|
| `spacecat-audit-worker` | New `screenshot` audit type | Uses existing `SCRAPE_CLIENT` step destination |
| `spacecat-api-service` | 3 new screenshot endpoints | Reuses `S3_SCRAPER_BUCKET`, `consentBanner.js` pattern |
| `experience-success-studio-backoffice` | New Screenshots page | Reuses `Reports.js` + `ReportDetails.js` patterns |
| `site-screenshot` (Option B only) | GitHub Actions workflow | Automates existing manual scripts |

---

## Review Feedback Log

| Date | Reviewer | Finding | Disposition |
|---|---|---|---|
| | | | |
