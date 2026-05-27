# Feature: Surface Semrush ad-copy fields (`Ds`, `Vu`) on `getPaidPages` keywords

**Package:** `@adobe/mysticat-shared-seo-client` (current v1.4.0 → next minor v1.5.0)
**Date:** 2026-05-27
**Author:** Daniel Huser
**Branch:** `feat/seo-client-paid-pages-ad-copy-fields`

## Summary

Request two additional `export_columns` (`Ds` — ad description, `Vu` — visible URL) from the Semrush `domain_adwords` report and surface them on each entry of the `result.pages[].keywords[]` array returned by `SeoClient.getPaidPages()`.

Change is **purely additive**:

- No existing column is removed from the Semrush request.
- No existing field is removed from the returned keyword shape.
- All current consumers of `getPaidPages` continue to receive the exact same fields they receive today, in the same shapes, with the same values. They simply get two additional optional fields they can ignore.

## Motivation

The Ad Intent Mismatch opportunity in the experience-success-studio UI shows a "Current Ad" panel per cluster. Today that panel can only render the SERP headline (sourced from Semrush column `Tt` → `serp_title`). The `CurrentAdCard.tsx` component intentionally omits a "What the ad promises" paragraph (parked per v3 plan §7.1) because the underlying ad-copy text isn't available downstream.

Mystique's ad-intent crew already produces a per-cluster `keywordAnalysis` block (`{ isBranded, intentType, intentExplanation }`) using the search-term text. With the ad description (`Ds`) and visible URL (`Vu`) flowing through, mystique can produce a parallel `adAnalysis` block (`{ adIntentType, adPromise, isBrandedAd? }`) that the UI can render in `CurrentAdCard`.

**Cost impact:** zero additional Semrush API calls. Semrush bills the `domain_adwords` endpoint per row, not per column ([provider docs verified](https://developer.semrush.com/api/v3/analytics/domain-reports/#adwords-keywords)). Adding `Ds,Vu` to `export_columns` returns the same row count for the same unit price.

**Verified:** as of 2026-05-27, the DEV opportunity `b11cd173-8051-48ff-8b90-2de7bc121ccb` carries `keywords[]` entries with only `keyword, traffic, cpc, serp_title, position, volume, country` — no ad description or visible URL anywhere.

## Out of scope

This PR ships the SEO-client change only. The cross-repo chain described under "Downstream work" is **not** part of this PR. Each downstream layer is its own PR after this package is published.

## Affected code (this PR)

### `src/endpoints.js`

```diff
   paidPages: {
     type: 'domain_adwords',
     path: API_PATHS.root,
-    columns: 'Ph,Ur,Tg,Nq,Cp,Po,Tt',
+    columns: 'Ph,Ur,Tg,Nq,Cp,Po,Tt,Ds,Vu',
     defaultParams: { display_sort: 'tg_desc', export_escape: 1 },
   },
```

`Ds` and `Vu` are already mapped in `HEADER_TO_CODE` (`src/utils.js:51-52`), so `parseCsvResponse` already converts the Semrush CSV headers `Description` and `Visible Url` to `row.Ds` and `row.Vu` automatically. No utils change required.

### `src/client.js` (`getPaidPages`, keywords map)

```diff
           keywords: page.keywords.map((kw) => ({
             keyword: kw.Ph,
             traffic: kw.kwTraffic,
             cpc: coerceValue(kw.Cp, 'float') ?? null,
             serp_title: kw.Tt || null,
+            serp_description: kw.Ds || null,
+            visible_url: kw.Vu || null,
             position: coerceValue(kw.Po, 'int') ?? null,
             volume: coerceValue(kw.Nq, 'int') ?? null,
             country: kw.db.toUpperCase(),
           })),
```

`|| null` mirrors the existing `serp_title` treatment — empty strings, `undefined`, and missing rows all coalesce to `null`.

### Tests (`test/client.test.js`)

- Extend the shared `paidKeywordsCsv` fixture's header to `Keyword;Url;Traffic;Search Volume;CPC;Position;Title;Description;Visible Url`, and append two values per row (use realistic ad copy).
- Extend the local `emptyPaidCsv` header in the `describe('getPaidPages')` block.
- Extend every inline CSV literal inside the `getPaidPages` describe block to add two trailing columns. Some rows leave the trailing columns empty to exercise the `|| null` fallback.
- Update the existing `expect(kw).to.have.all.keys(...)` assertion to include `serp_description` and `visible_url`.
- Add positive value assertions in the "returns keywords[] with all expected fields per page" test for both new fields.
- Add a new test "keywords[] returns null for missing serp_description and visible_url" exercising the `|| null` fallback (mirrors the existing `Sparse` test).

No new types in `src/index.d.ts` are needed — the per-keyword shape is not declared there (the return type is `result: object`).

## Verification — spacecat-shared (`packages/mysticat-shared-seo-client`)

- **Package manager**: npm (npm workspaces monorepo, root `package-lock.json`)
- **Node version**: `>=22.0.0 <25.0.0` (from package.json `engines`; no `.nvmrc` at package level — root governs)
- **Test command**: `npm test -w packages/mysticat-shared-seo-client`
- **Lint command**: `npm run lint -w packages/mysticat-shared-seo-client`
- **Coverage thresholds** (`.nycrc.json` per the spacecat-shared CLAUDE.md): **100% lines/statements, 97% branches** per package — must remain green after the change.
- **Pre-commit hooks**: yes — husky + lint-staged runs ESLint on staged `.js` files.
- **Test cases for new/changed branches**:
  - [ ] Existing test: `kw.serp_title` populated → still passes with `serp_description`/`visible_url` populated alongside.
  - [ ] New assertion: `kw.serp_description` and `kw.visible_url` equal the expected fixture values for the top row.
  - [ ] New test: `Ds` is empty in CSV → `kw.serp_description === null` (covers `|| null` falsy branch).
  - [ ] New test: `Vu` is empty in CSV → `kw.visible_url === null` (covers `|| null` falsy branch).
  - [ ] All-keys assertion: updated to include both new keys.

## Commit + release

- **Conventional commit** (semantic-release will publish a minor version on merge):
  - `feat(mysticat-shared-seo-client): include ad description and visible URL in getPaidPages keywords`
- semantic-release's `semantic-release-monorepo` config will bump `@adobe/mysticat-shared-seo-client` from `1.4.0` → `1.5.0` automatically on merge to `main`.

## Downstream work (NOT in this PR — tracked for the chain)

After this package is published, the following repos need follow-up PRs to surface the new fields end-to-end:

| # | Repo | Change | PR pattern |
|---|------|--------|-----------|
| 1 | `spacecat-import-worker` | Bump dep to new SEO client version. In `src/mapper/seo.js` `mapPaidPages` keyword map, add `serp_description: kw.serp_description ?? null` and `visible_url: kw.visible_url ?? null` to the strict allowlist. | (new PR) |
| 2 | `mysticat-architecture` | Add spec describing the new `cluster.adAnalysis` block in the mystique↔audit-worker wire format. | Similar to the spec branch that backed PR #2353 / `spacecat-audit-worker#2551`. |
| 3 | `mystique` | Ad-intent crew consumes `serp_description` + `visible_url` + landing-page URL/H1 per cluster and emits `cluster.adAnalysis = { adIntentType, adPromise, isBrandedAd? }`. | PR #2353. |
| 4 | `spacecat-audit-worker` | Pass-through type extension: add optional `cluster.adAnalysis` next to `cluster.keywordAnalysis`. | PR #2551. |
| 5 | `experience-success-studio-ui` | New branch off `main` (not on PR #1888). Extend `adIntentCluster.ts` types; render "What the ad promises" block in `CurrentAdCard.tsx` when `cluster.adAnalysis?.adPromise` has text; add `currentAdWhatAdPromisesLabel` l10n; extend tests. | (new PR on OneAdobe) |

**Suggested ordering:**

1. Mystique architecture spec update (sets the contract).
2. This PR — SEO client publish.
3. import-worker mapper PR (bumps SEO client dep, extends mapping).
4. mystique implementation PR (consumes new keyword fields, emits `adAnalysis`).
5. audit-worker pass-through PR.
6. UI repo PR — `CurrentAdCard` renders `adAnalysis` when present.
7. End-to-end test via `/ad-intent-dry-run` skill on a test URL.

## Backwards compatibility & rollout

- **Existing consumers** of `getPaidPages` (import-worker `seo.js` mapper, anyone calling the client directly) will receive two new fields they don't read. The import-worker mapper explicitly allowlists fields, so the new fields are silently dropped there until step 1 above lands — i.e., publishing this package alone changes nothing downstream.
- **Pinned consumers** (e.g. `spacecat-import-worker/package.json` pins a specific `@adobe/mysticat-shared-seo-client` version) won't even see the new fields until they bump the dep. Bumping is deliberate per downstream PR.
- **No rollback risk** for downstream consumers — even if mystique's `adAnalysis` emission is delayed, the UI's `CurrentAdCard` render is conditional on `cluster.adAnalysis?.adPromise` having text (hide-when-missing pattern, same as `resolvedPageHeading`).

## Open questions for the downstream PRs (NOT blockers for this PR)

1. Does mystique own the `adAnalysis` schema, or does an ADR in `mysticat-architecture` land first?
2. Is `isBrandedAd` worth carrying separately from `keywordAnalysis.isBranded`, or can the UI assume identity?
3. Confirm with the mystique team that the existing crew prompt can absorb the ad-copy fields without exceeding the per-cluster context budget.
