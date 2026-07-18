# Prompt-Suggestion Schedules — spacecat-shared Changes

## Overview

Adds a generic `createSchedule(...)` method to the DRS client
(`@adobe/spacecat-shared-drs-client`) so callers can register **recurring**
DRS prompt-suggestion schedules with a fixed, audited cadence. This is the
shared-library slice of a cross-repo feature that makes the three DRS
"prompt suggestion" pipelines — SEMrush suggestions, Citation Attempts
(agentic traffic), and Synthetic Personas — run on a schedule and fire once
at site onboarding.

Before this change the client only exposed purpose-built creators
(`createBrandPresenceSchedule`, `createExperimentSchedule`). There was no
generic way to register a recurring schedule for a prompt-suggestion provider,
so onboarding and backfill callers had no supported entry point.

## Change

**Package:** `packages/spacecat-shared-drs-client`
**Files:** `src/index.js`, `src/index.d.ts`, `test/index.test.js`

### New public API

```js
import { DrsClient, SCHEDULE_CADENCES } from '@adobe/spacecat-shared-drs-client';

const drsClient = DrsClient.createFrom(context);

const { scheduleId, alreadyExisted } = await drsClient.createSchedule({
  siteId,                         // required — the only tenant identifier sent
  providerIds,                    // required — array, e.g. ['prompt_generation_semrush']
  cadence,                        // required — SCHEDULE_CADENCES.TWICE_MONTHLY | .QUARTERLY
  description,                    // required — <= 1024 chars
  enableBrandPresence = false,
  providerParameters,            // optional
  priority = 'HIGH',             // 'HIGH' | 'LOW'
  metadata,                      // optional (must NOT contain an imsOrgId key)
  triggerImmediately = false,    // DRS runs the first job server-side from this flag
  timeout,
});
```

New named export:

```js
export const SCHEDULE_CADENCES = {
  TWICE_MONTHLY: 'twice_monthly', // 1st & 15th, server-jittered hour per site
  QUARTERLY: 'quarterly',         // 1st of Jan/Apr/Jul/Oct
};
```

## Contract / design

- **DRS is the sole cron authority.** The client sends only the `cadence`
  label; it does **not** compute or send a `cron_expression`. DRS derives the
  concrete cron and a deterministic per-site hour jitter server-side. (An
  earlier iteration computed cron client-side; that was removed because DRS
  overwrites it, and the two jitter implementations differed, producing
  misleading client-side logs.)
- **Constrained cadence, not free-form cron.** Only the `SCHEDULE_CADENCES`
  values are accepted; an unknown cadence throws. This closes the
  "leaked API key sets `* * * * *` → fleet-wide Fargate storm" risk.
- **Tenant isolation (defense in depth).** The shared body builder rejects any
  caller-supplied `imsOrgId`-shaped key (`ims_org_id` / `imsOrgId` / hyphen and
  case variants) at any depth of `job_config`, including inside arrays. The
  authoritative isolation control is server-side: DRS derives the S3 isolation
  key from `siteId` and ignores any org id in the payload.
- **Input caps.** `description` is capped at 1024 characters; the serialized
  `job_config` is capped at 100 KB (`Buffer.byteLength`, UTF-8) — well under the
  DynamoDB 400 KB item limit.
- **Idempotency.** `POST /schedules` de-dupes on `(site_id, provider_id)`
  server-side. A `200 { idempotent: true }` or a `409` dedup are both treated
  as success and return `{ scheduleId, alreadyExisted: true }`. Dedup is
  **create-only**: a re-POST with a changed `cadence` / `job_config` returns the
  existing row unchanged (it does not update it). Non-2xx/409 statuses throw.
- **Shared builder.** `createSchedule` and `createExperimentSchedule` share a
  private `#buildScheduleBody`, so the imsOrgId guard and size caps apply to
  both and the two `POST /schedules` paths cannot drift.

### Backward compatibility

Routing `createExperimentSchedule` through the shared builder means it now also
rejects a caller-supplied `imsOrgId` in `metadata` (previously accepted as
opaque). A grep of `spacecat-api-service`, `llmo-data-retrieval-service`, and
`spacecat-audit-worker` found **zero** callers of `createExperimentSchedule`,
so this tightening breaks no existing consumer. The method is additive
(`feat:`), no major version bump required.

## Cadence rationale

| Pipeline | Provider id | Cadence |
|---|---|---|
| SEMrush suggestions | `prompt_generation_semrush` | twice-monthly |
| Citation Attempts | `prompt_generation_agentic_traffic` | twice-monthly |
| Synthetic Personas | `prompt_generation_synthetic_personas` | quarterly |

`enable_brand_presence` defaults to `false` for these schedules (prompt-only;
not fed into the brand-presence post-processing / SNS allowlist unless a caller
explicitly opts in).

## Dependent repositories

| Repository | Role | Action required |
|---|---|---|
| `llmo-data-retrieval-service` | Server authority: `POST /schedules` handler derives cron + isolation key, enforces `(site_id, provider_id)` idempotency, and the scheduler fires due rows | PR #2714 (schedules) + #2719 (cross-run SR merge) |
| `spacecat-api-service` | Calls `createSchedule` from V2 LLMO onboarding to register the three recurring schedules (best-effort, `settleWithin`-bounded) | Bump `@adobe/spacecat-shared-drs-client` to the published version; PR #2824 |

## Deployment order

1. Merge this PR → semantic-release publishes `@adobe/spacecat-shared-drs-client@1.14.0`.
2. Bump the dependency in `spacecat-api-service` (regenerate `package-lock.json`) → PR #2824 CI goes green.
3. `llmo-data-retrieval-service` PRs (#2714, #2719) are independent and can merge on their own timeline.

## Out of scope (tracked elsewhere)

- Provider enablement (per-provider Fargate whitelists) + VPC-quota sign-off.
- The agentic-traffic pipeline's 0-prompt health fix must land before Citation
  Attempts is scheduled recurringly.
- The cross-run "accumulate + replace-by-key, newest-on-top" merge of the
  Strategic Recommendations sheet (DRS PR #2719).
