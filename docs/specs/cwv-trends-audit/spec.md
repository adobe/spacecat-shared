# CWV Trends Audit — spacecat-shared Changes

## Overview

Adds the `CWV_TRENDS_AUDIT` audit type to `Audit.AUDIT_TYPES` in the `spacecat-shared-data-access` package, enabling the new CWV Trends Audit feature across the SpaceCat ecosystem.

## Change

**File:** `packages/spacecat-shared-data-access/src/models/audit/audit.model.js`

```javascript
static AUDIT_TYPES = {
  // ... existing types ...
  CWV_TRENDS_AUDIT: 'cwv-trends-audit',
};
```

## Context

The CWV Trends Audit is a weekly audit (`every-sunday`) that:

- Reads 28 days of pre-imported CWV data from S3 (`metrics/cwv-trends/cwv-trends-daily-{date}.json`)
- Classifies URLs as Good / Needs Improvement / Poor using standard CWV thresholds
- Determines device type (mobile/desktop) from site handler configuration
- Creates/updates device-specific opportunities: "Mobile Web Performance Trends Report" or "Desktop Web Performance Trends Report"
- Syncs per-URL suggestions with `CONTENT_UPDATE` type

## Dependent Repositories

| Repository | Dependency | Action Required |
|---|---|---|
| `spacecat-audit-worker` | `@adobe/spacecat-shared-data-access` | Bump version after this package is published |
| `spacecat-api-service` | `@adobe/spacecat-shared-data-access` | Bump version to recognize the new audit type |

## Deployment Order

1. Merge this PR → semantic-release publishes new `@adobe/spacecat-shared-data-access`
2. Bump dependency in `spacecat-audit-worker` and `spacecat-api-service`
3. Register audit: `registerAudit('cwv-trends-audit', false, 'every-sunday', [productCodes])`
