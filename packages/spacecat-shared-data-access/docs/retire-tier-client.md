# Proposal: Retire `@adobe/spacecat-shared-tier-client`

**Status:** Proposal
**Author:** ekdogan
**Date:** 2026-03-04

## Thesis

**All of TierClient's complexity was DynamoDB workarounds.** Now that we're on PostgreSQL (via PostgREST), every TierClient method can be replaced by a collection method using PostgREST resource embedding (JOINs). The package should be fully retired — not partially — because none of the patterns it encapsulates are necessary with a relational database.

**Important distinction:** Some TierClient methods are individually inefficient (e.g., `getAllEnrollment` chunking, `getFirstEnrollment` iterating). Others are perfectly fine per-invocation but get called in N+1 patterns by consumers (e.g., `checkValidEntitlement` is 1-2 queries — the problem is `orgs2.js` calling it ~928 times in a loop). The retirement addresses both: replacing inefficient methods with JOINs, and giving consumers bulk-query alternatives so N+1 loops aren't needed.

## Background

`@adobe/spacecat-shared-tier-client` was created when SpaceCat used DynamoDB. DynamoDB has no JOINs, no server-side filtering across tables, and no way to atomically query related entities. TierClient compensated for these limitations:

- **N+1 lookups** — checking entitlements required fetching each entity separately
- **Chunked batch fetches** (`CHUNK_SIZE = 50`) — DynamoDB's `BatchGetItem` has a 100-key limit, and URL-encoded key lists hit PostgREST's 414 URI Too Large when migrated as-is
- **Client-side org-ownership validation** — DynamoDB couldn't JOIN `site_enrollments → sites → organizations`, so TierClient fetched each site individually and checked `organizationId` in application code
- **Iterative lookups** (`getFirstEnrollment`) — without JOINs, finding the first valid enrollment required fetching sites one-by-one until a match was found

With PostgreSQL, all of these are single queries using foreign-key relationships that already exist in the schema:

```
entitlements.organization_id  → organizations(id)
site_enrollments.site_id      → sites(id)
site_enrollments.entitlement_id → entitlements(id)
sites.organization_id         → organizations(id)
```

## Method-by-Method Analysis

### 1. `checkValidEntitlement()` — 13 call sites

**Current implementation:** Two sequential queries — `Entitlement.findByOrganizationIdAndProductCode()`, then optionally `SiteEnrollment.allBySiteId()` filtered in JS by entitlement ID. The method itself is efficient (1-2 queries per call). The N+1 problem occurs when consumers call it in a loop (e.g., `orgs2.js` calling it ~928 times via `Promise.all`).

**PostgREST replacement — two variants:**

Org-only (most callers):
```javascript
// EntitlementCollection.findValidForOrganization(orgId, productCode)
const { data } = await this.postgrestService
  .from('entitlements')
  .select('*')
  .eq('organization_id', orgId)
  .eq('product_code', productCode)
  .maybeSingle();
```

With site enrollment check (when `siteId` is needed):
```javascript
// EntitlementCollection.findValidForSite(orgId, productCode, siteId)
const { data } = await this.postgrestService
  .from('entitlements')
  .select('*, site_enrollments!inner(*)')
  .eq('organization_id', orgId)
  .eq('product_code', productCode)
  .eq('site_enrollments.site_id', siteId)
  .maybeSingle();
```

The site-enrollment embedding is only included when a caller actually needs it, avoiding unnecessary JOINs for the majority of call sites that only check org-level entitlement.

**Callers:**
| Repo | Files | Variant |
|---|---|---|
| spacecat-auth-service | `login.js`, `orgs.js`, `orgs2.js`, `s2s-login.js`, `promise.js` | org-only |
| spacecat-auth-service | `access-control-util.js` | both (site + org) |
| spacecat-api-service | `support/utils.js`, `slack/commands/get-entitlement-site.js`, `slack/commands/run-audit.js` | with-site |
| spacecat-api-service | `access-control-util.js`, `slack/commands/get-entitlement-imsorg.js` | org-only |
| spacecat-import-worker | `import-helper.js` | with-site |

**Migration effort:** Low. Callers replace `TierClient.createFor*(…).checkValidEntitlement()` with the appropriate variant. Return shape stays the same.

---

### 2. `createEntitlement(tier)` — 9 call sites

**Current implementation:** Find-or-update entitlement + create site enrollment. Business rules:
1. If entitlement exists with a different tier, update tier — **unless current tier is `PAID`** (don't downgrade)
2. If site is provided and no enrollment exists, create one
3. New entitlements get hardcoded quotas: `{ llmo_trial_prompts: 200, llmo_trial_prompts_consumed: 0 }`

**Business logic note:** The "don't downgrade PAID" guard and hardcoded quotas (`llmo_trial_prompts: 200`) are product-specific business rules. There's a valid question about whether these belong in the data layer (`EntitlementCollection`) or in a thin service layer in consumer repos. Our recommendation: keep them in the collection. The PAID guard is a data integrity constraint (prevent invalid state transitions), and the default quotas are a creation default — both are closer to the data than to any specific consumer's workflow. If product-specific rules grow more complex in the future, they can be extracted then.

**PostgREST replacement:**
```javascript
// EntitlementCollection.createOrUpdateWithEnrollment(orgId, productCode, tier, siteId?)
async createOrUpdateWithEnrollment(orgId, productCode, tier, siteId) {
  let entitlement = await this.findByOrganizationIdAndProductCode(orgId, productCode);
  if (entitlement) {
    if (entitlement.getTier() !== tier && entitlement.getTier() !== 'PAID') {
      entitlement.setTier(tier);
      await entitlement.save();
    }
  } else {
    entitlement = await this.create({ organizationId: orgId, productCode, tier, quotas: DEFAULT_QUOTAS });
  }
  if (siteId) {
    // SiteEnrollmentCollection.create() already deduplicates via unique constraint
    await this.entityRegistry.getCollection('SiteEnrollmentCollection')
      .create({ siteId, entitlementId: entitlement.getId() });
  }
  return entitlement;
}
```

**Callers:**
| Repo | Files |
|---|---|
| spacecat-api-service | `support/utils.js`, `controllers/llmo/llmo-onboarding.js`, `slack/actions/entitlement-modals.js`, `slack/actions/entitlement-modal-utils.js`, `controllers/entitlements.js` |
| spacecat-fulfillment-worker | `llmo-optimizer.js`, `aem-sites-optimizer.js` |

**Migration effort:** Medium. The method signature changes from `TierClient.createForSite(ctx, site, code).createEntitlement(tier)` to `Entitlement.createOrUpdateWithEnrollment(orgId, code, tier, siteId)`. Callers that currently pass a `site` object will pass `site.getId()` and `site.getOrganizationId()` instead.

---

### 3. `getAllEnrollment()` — 1 call site

**Current implementation (lines 226-294 of tier-client.js):** The most complex method. Two code paths:

- **Site path:** Fetch all enrollments, filter by `targetSiteId`, verify org ownership with `Site.findById()`
- **Org path:** Fetch all enrollments, extract site IDs, batch-fetch sites in chunks of 50 via `batchGetByKeys()`, filter by organization ID match

The chunking (`CHUNK_SIZE = 50`, lines 264-275 of tier-client.js, added in [PR #1390](https://github.com/adobe/spacecat-shared/pull/1390)) exists because PostgREST uses `GET` with `?id=in.(...)` query params, and large site ID lists hit the 414 URI Too Large limit. A defense-in-depth fix was also added to `BaseCollection.batchGetByKeys()` itself ([PR #1391](https://github.com/adobe/spacecat-shared/pull/1391)). Both were post-migration band-aids — the underlying problem is that the client fetches enrollment IDs, then has to turn around and batch-fetch the related sites because there's no JOIN.

**PostgREST replacement:**
```javascript
// SiteEnrollmentCollection.allWithDetailsByOrganization(orgId, productCode, siteId?)
const query = this.postgrestService
  .from('site_enrollments')
  .select('*, sites!inner(id, base_url, organization_id), entitlements!inner(id, product_code, tier)')
  .eq('entitlements.organization_id', orgId)
  .eq('entitlements.product_code', productCode);
if (siteId) query.eq('site_id', siteId);
const { data } = await query;
```

**One query. No chunking. No client-side org validation.** The `!inner` JOIN ensures only matching rows are returned. The `WHERE` clause on `entitlements.organization_id` replaces the entire org-ownership validation loop.

**Callers:**
| Repo | Files |
|---|---|
| spacecat-api-service | `controllers/sites.js` |

**Migration effort:** Low. Single call site.

---

### 4. `getFirstEnrollment()` — 1 call site

**Current implementation (lines 302-347):** Same two paths as `getAllEnrollment()` but returns the first match. The org-only path iterates enrollments **one-by-one**, calling `Site.findById()` for each until it finds one belonging to the target org. This is O(n) HTTP requests in the worst case.

**PostgREST replacement:** Same query as `getAllEnrollment()` with `.limit(1)`.

**Callers:**
| Repo | Files |
|---|---|
| spacecat-api-service | `controllers/sites.js` |

**Migration effort:** Low. Single call site.

---

### 5. `revokeEntitlement()` — 1 call site

**Current implementation:** Find entitlement by org + product code, throw if tier is `PAID`, then remove.

**PostgREST replacement:**
```javascript
// EntitlementCollection.revokeByOrganization(orgId, productCode)
async revokeByOrganization(orgId, productCode) {
  const entitlement = await this.findByOrganizationIdAndProductCode(orgId, productCode);
  if (!entitlement) throw new Error('Entitlement not found');
  if (entitlement.getTier() === 'PAID') throw new Error('Cannot revoke PAID entitlement');
  await entitlement.remove();
}
```

**Callers:**
| Repo | Files |
|---|---|
| spacecat-api-service | `slack/actions/entitlement-modals.js` |

**Migration effort:** Low. Single call site.

---

### 6. `revokeSiteEnrollment()` — 2 call sites

**Current implementation:** Find enrollment by site ID + entitlement ID, throw if not found, remove.

**PostgREST replacement:**
```javascript
// SiteEnrollmentCollection.revokeBySiteAndEntitlement(siteId, entitlementId)
async revokeBySiteAndEntitlement(siteId, entitlementId) {
  const enrollment = await this.findBySiteIdAndEntitlementId(siteId, entitlementId);
  if (!enrollment) throw new Error('Enrollment not found');
  await enrollment.remove();
}
```

**Callers:**
| Repo | Files |
|---|---|
| spacecat-api-service | `controllers/llmo/llmo-onboarding.js`, `slack/actions/entitlement-modals.js` |

**Migration effort:** Low.

---

### 7. `revokePaidEntitlement()` — 0 call sites

**Current implementation:** Same as `revokeEntitlement()` but without the PAID tier guard.

**No callers.** Delete without replacement.

---

## The Factory Pattern Is Also a DynamoDB Artifact

TierClient uses two factory methods — `createForOrg(context, organization, productCode)` and `createForSite(context, site, productCode)` — because DynamoDB required the full entity objects to extract partition keys for subsequent queries. With PostgreSQL, all we need are IDs:

| TierClient factory | What it extracts | PostgREST needs |
|---|---|---|
| `createForOrg(ctx, org, code)` | `org.getId()` | `organizationId` (string) |
| `createForSite(ctx, site, code)` | `site.getId()`, `site.getOrganizationId()` + async `Organization.findById()` | `siteId` (string), `organizationId` (string) |

The `createForSite` factory even makes an extra HTTP request to resolve the organization, just to store it on the instance. With PostgREST JOINs, the database resolves these relationships.

## Migration Summary

| Method | Call sites | New home | Effort |
|---|---|---|---|
| `checkValidEntitlement` | 13 | `EntitlementCollection` | Low |
| `createEntitlement` | 9 | `EntitlementCollection` | Medium |
| `getAllEnrollment` | 1 | `SiteEnrollmentCollection` | Low |
| `getFirstEnrollment` | 1 | `SiteEnrollmentCollection` | Low |
| `revokeEntitlement` | 1 | `EntitlementCollection` | Low |
| `revokeSiteEnrollment` | 2 | `SiteEnrollmentCollection` | Low |
| `revokePaidEntitlement` | 0 | (delete) | None |
| **Total** | **27** | | |

**Affected repos:** `spacecat-api-service` (10 files), `spacecat-auth-service` (6 files), `spacecat-fulfillment-worker` (2 files), `spacecat-import-worker` (1 file).

## Proposed Execution Plan

### Phase 1: Add collection methods to `spacecat-shared-data-access`

Add the following to `EntitlementCollection`:
- `findValidForOrganization(orgId, productCode, siteId?)`
- `createOrUpdateWithEnrollment(orgId, productCode, tier, siteId?)`
- `revokeByOrganization(orgId, productCode)`
- `allByProductCodeWithOrganization(productCode)` — shipped in [PR #1402](https://github.com/adobe/spacecat-shared/pull/1402), released in `@adobe/spacecat-shared-data-access@3.8.0`

Add the following to `SiteEnrollmentCollection`:
- `allWithDetailsByOrganization(orgId, productCode, siteId?)`
- `revokeBySiteAndEntitlement(siteId, entitlementId)`

Release a new `@adobe/spacecat-shared-data-access` version (remaining methods).

### Phase 2: Migrate callers (per repo)

For each consumer repo:
1. Bump `spacecat-shared-data-access`
2. Replace `TierClient` calls with collection methods
3. Remove `@adobe/spacecat-shared-tier-client` from `package.json`

Order: `spacecat-auth-service` → `spacecat-api-service` → `spacecat-fulfillment-worker` → `spacecat-import-worker`

(Auth-service first because it's the one hitting production errors today.)

**Migration note — plain objects vs model instances:** Some new collection methods (like `allByProductCodeWithOrganization` in PR #1402) return plain objects rather than model instances, since they combine fields from multiple entities via JOINs. Callers migrating from TierClient will need to switch from getter methods (`entitlement.getId()`, `entitlement.getTier()`) to direct property access (`entitlement.id`, `entitlement.tier`). Methods that return single-entity results (like `findValidForOrganization`) will continue to return model instances.

### Phase 3: Archive `spacecat-shared-tier-client`

- Mark package as deprecated on npm
- Archive the source directory in `spacecat-shared`

## Benefits

1. **Performance:** N+1 queries become single JOINs. The `getAllEnrollment` chunking loop (potentially dozens of HTTP requests) becomes one query.
2. **Consistency:** Entitlement logic lives next to the data model, not in a separate package with its own release cycle.
3. **Reduced dependency surface:** Four consumer repos drop a dependency.
4. **Simpler mental model:** Developers use `dataAccess.Entitlement.*` and `dataAccess.SiteEnrollment.*` — no need to understand TierClient's factory pattern, dual-mode (site vs. org) branching, or when to use which factory.
