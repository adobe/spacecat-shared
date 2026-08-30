# URL-Scoped Entity Queries via Suggestion URL Index

**Date:** 2026-04-15
**Author:** Sandesh Sinha
**Ticket:** SITES-42988
**Status:** Brainstorm

---

## 1. Problem Statement

Four query patterns are needed that today cannot be answered at the database layer:

| # | Query | Entity owning the URL | Missing capability | Consumer |
|---|-------|-----------------------|--------------------|----------|
| 1 | Fetch opportunities for a site that impact a given URL prefix | `Suggestion` (child of Opportunity) | No index linking suggestions' URLs back to their parent opportunity | — |
| 2 | Fetch suggestions for an opportunity that impact a given URL prefix | `Suggestion` | URLs are buried in `data jsonb` — location varies by `suggestion.type` | — |
| 3 | Fetch fix entities for an opportunity that impact a given URL prefix, ordered by `fixEntityCreatedAt` | `Suggestion` (fix entity linked via many-to-many) | Same as above; ordering adds a secondary requirement | — |
| 4 | Fetch all opportunities across all sites that impact a given URL prefix | `Suggestion` (child of Opportunity) | Same as query 1 but without a site scope — no cross-site index exists today | SHM |

In all three cases the URL lives in `Suggestion.data`, not in any indexed column. There is no standard key — a `REDIRECT_UPDATE` suggestion might use `data.url`, a `CONTENT_UPDATE` might use `data.pageUrl`. This rules out a single generated column expression.

Callers today must fetch all suggestions for an opportunity and filter in application memory, which does not scale and produces incorrect results when pagination is applied.

---

## 2. Data Model Context

```
Site ──→ Opportunity ──→ Suggestion ──→ (url lives here, in data jsonb)
                    └──→ FixEntity  ←── fix_entity_suggestions ──→ Suggestion
```

Key schema facts relevant to this design:

- `Opportunity.siteId` — direct FK to site (already indexed)
- `Suggestion.opportunityId` — direct FK to opportunity (already indexed)
- `FixEntitySuggestion.suggestionId` + `FixEntitySuggestion.fixEntityId` — join table
- `FixEntitySuggestion.opportunityId` — **already denormalized** on the join table, with an existing index on `(opportunityId, fixEntityCreatedDate, updatedAt)`
- `FixEntitySuggestion.fixEntityCreatedAt` — timestamp stored on the join record; used for ordering

---

## 3. Design Options Considered

### Option A: Generated column on `suggestions.data`

```sql
ADD COLUMN url_normalized text
  GENERATED ALWAYS AS (regexp_replace(data->>'url', '^https?://', '')) STORED;
```

| Aspect | Assessment |
|--------|-----------|
| Query simplicity | Single table scan |
| Handles variable key names | No — only works for a fixed JSON key |
| Handles multiple URLs per suggestion | No — scalar only |
| Handles type-conditional extraction | No |

**Rejected.** URL location is not uniform across `suggestion.type` values.

### Option B: Normalized URL registry (shared `urls` table)

A shared `urls` table with one row per unique URL, referenced by association tables. Deduplicates URL strings across entities.

| Aspect | Assessment |
|--------|-----------|
| Prefix filter query | Two queries: scan all of `urls` for matching IDs (unscoped), then join back to entity |
| Write path | Upsert to `urls`, then insert association |
| Storage win | ~100 bytes per URL — negligible |
| Index hit | First scan is unscoped across all entities before narrowing |

**Rejected.** The unscoped first query is worse than the current state. The storage saving does not justify the query complexity.

### Option C: Per-entity URL junction table with denormalized ancestor FKs (chosen)

A `suggestion_urls` table stores each suggestion-URL pair alongside `opportunity_id` (denormalized from the suggestion record at save time). A `GENERATED ALWAYS` column `url_normalized` strips the URL scheme and is indexed with `text_pattern_ops`.

| Aspect | Assessment |
|--------|-----------|
| Handles variable key/multi-URL | Yes — extraction logic in JS, registered per entity type |
| Prefix filter query | Single composite index scan `(opportunity_id, url_normalized)` |
| Write path | Simple insert after suggestion save; no extra lookup needed |
| Ordering (query 3) | `fix_entity_suggestions` already has `fixEntityCreatedAt`; traversal preserves order |
| Consistent with codebase | Yes — mirrors the existing `audit_urls` pattern |

**Chosen.**

---

## 4. Solution

### 4.1 `suggestion_urls` table

```sql
CREATE TABLE suggestion_urls (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
    suggestion_id   uuid NOT NULL REFERENCES suggestions   (id) ON DELETE CASCADE,
    opportunity_id  uuid NOT NULL REFERENCES opportunities (id) ON DELETE CASCADE,
    url             text NOT NULL CONSTRAINT suggestion_url_valid CHECK (url ~ '^https?://'),
    url_normalized  text GENERATED ALWAYS AS (regexp_replace(url, '^https?://', '')) STORED,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_suggestion_url UNIQUE (suggestion_id, url)
);

-- For query 2: suggestions for an opportunity matching a URL prefix (composite, single scan)
CREATE INDEX idx_suggestion_urls_opp_normalized
    ON suggestion_urls (opportunity_id, url_normalized text_pattern_ops);

-- For query 1 and 3: resolve opportunity_id / suggestion_id by URL prefix across all opportunities
CREATE INDEX idx_suggestion_urls_normalized
    ON suggestion_urls (url_normalized text_pattern_ops);

-- For cascade checks and per-suggestion lookups
CREATE INDEX idx_suggestion_urls_suggestion_id
    ON suggestion_urls (suggestion_id);
```

`opportunity_id` is denormalized because `suggestion.opportunityId` is already on the record at save time — no extra DB lookup required during sync. This makes queries 1 and 3 possible without a JOIN to `suggestions`.

### 4.2 URL extractor registered per entity type

Each entity type that owns URLs declares a `withUrlExtractor(fn)` in its schema. The function receives the raw entity record and returns `string[]`. The framework is agnostic to where URLs are stored.

```js
// suggestion.schema.js — field names are placeholders; entity owner fills these in
.withUrlExtractor((record) => {
  const urls = [];
  // Type-specific logic — only this file needs to know where URLs live
  if (record.data?.url) urls.push(record.data.url);
  if (record.data?.pageUrl) urls.push(record.data.pageUrl);
  return [...new Set(urls.filter((u) => u && isValidUrl(u)))];
})
```

### 4.3 Post-save hook (best-effort)

`BaseCollection.#syncEntityUrls(entity)` runs after every `save` / `saveMany` / `update`. It calls the extractor, deletes existing URL rows for the entity, and inserts the new set. If the sync fails, a warning is logged and the entity save still succeeds — URL sync failure is non-fatal.

Entities without a registered extractor (`Opportunity`, `FixEntity`) are unaffected — the hook is a no-op.

---

## 5. Query Implementations

### Query 1 — Fetch opportunities for a site impacting a URL prefix

`OpportunityCollection.allBySiteIdAndUrlPrefix(siteId, urlPrefix)`

```
Step 1:  SELECT DISTINCT opportunity_id
         FROM suggestion_urls
         WHERE url_normalized LIKE 'example.com/blog%'
         → idx_suggestion_urls_normalized

Step 2:  SELECT … FROM opportunities
         WHERE site_id = siteId AND id IN (opportunity_ids)
         → idx_opportunities_site_id

Round-trips: 2
```

`opportunity_id` is denormalized in `suggestion_urls`, so step 1 returns parent IDs directly without joining to `suggestions`.

### Query 2 — Fetch suggestions for an opportunity impacting a URL prefix

`SuggestionCollection.allByOpportunityIdAndUrlPrefix(opportunityId, urlPrefix)`

```
Step 1:  SELECT suggestion_id
         FROM suggestion_urls
         WHERE opportunity_id = oppId
           AND url_normalized LIKE 'example.com/blog%'
         → idx_suggestion_urls_opp_normalized  (composite — covers both filters in one scan)

Step 2:  SELECT … FROM suggestions
         WHERE id IN (suggestion_ids)

Round-trips: 2  (step 1 is a single composite index scan)
```

### Query 3 — Fetch fix entities for an opportunity impacting a URL prefix, ordered by `fixEntityCreatedAt`

`FixEntityCollection.allByOpportunityIdAndUrlPrefix(opportunityId, urlPrefix)`

```
Step 1:  SELECT suggestion_id
         FROM suggestion_urls
         WHERE opportunity_id = oppId
           AND url_normalized LIKE 'example.com/blog%'
         → idx_suggestion_urls_opp_normalized

Step 2:  SELECT fix_entity_id, fix_entity_created_at
         FROM fix_entity_suggestions
         WHERE opportunity_id = oppId
           AND suggestion_id IN (suggestion_ids)
         ORDER BY fix_entity_created_at ASC
         → idx_fix_entity_suggestions_opportunity_id  (already exists)

Step 3:  SELECT … FROM fix_entities
         WHERE id IN (fix_entity_ids)
         (results re-ordered client-side to match Step 2 ordering)

Round-trips: 3  (no new table — reuses existing fix_entity_suggestions join table)
```

`fix_entity_created_at` is already stored on `fix_entity_suggestions` (see `fix-entity-suggestion.schema.js` line 38). Ordering is applied in step 2, and the final result set is sorted client-side to match since the `IN` query does not guarantee order.

### Query 4 — Fetch all opportunities impacting a URL prefix (SHM)

`OpportunityCollection.allByUrlPrefix(urlPrefix)`

```
Step 1:  SELECT DISTINCT opportunity_id
         FROM suggestion_urls
         WHERE url_normalized LIKE 'example.com/blog%'
         → idx_suggestion_urls_normalized

Step 2:  SELECT … FROM opportunities
         WHERE id IN (opportunity_ids)

Round-trips: 2
```

No site scope — `idx_suggestion_urls_normalized` (the non-composite index on `url_normalized text_pattern_ops`) covers the prefix scan across all opportunities. This is the same index used as a fallback strategy in Query 1 when the URL prefix is highly selective.

---

## 6. Implementation Plan

### Phase 1 — Database (mysticat-data-service)

1. New migration `20260419120000_suggestion_urls.sql` — `suggestion_urls` table with indexes (see §4.1)

### Phase 2 — Framework (spacecat-shared-data-access)

1. **`schema.builder.js`** — add `.withUrlExtractor(fn)` method; store on built schema
2. **`postgrest.utils.js`** — add `generatedFields` set to `createFieldMaps`; guard in `toDbRecord` to skip `GENERATED ALWAYS` columns on writes
3. **`base.collection.js`** — implement `#syncEntityUrls(entity)` with retry + outbox; hook into `save` and `saveMany`

### Phase 3 — Entity schemas (spacecat-shared-data-access)

1. **`suggestion.schema.js`** — register `withUrlExtractor` (field names filled in by entity owner)

### Phase 4 — Collection methods (spacecat-shared-data-access)

1. **`suggestion.collection.js`** — `allByOpportunityIdAndUrlPrefix` (Query 2)
2. **`opportunity.collection.js`** — `allBySiteIdAndUrlPrefix` (Query 1), `allByUrlPrefix` (Query 4 — SHM)
3. **`fix-entity.collection.js`** — `allByOpportunityIdAndUrlPrefix` (Query 3)

### Phase 5 — Backfill

One-time script: iterate all existing `Suggestion` rows, run extractor, insert into `suggestion_urls`. Must run before enabling URL-prefix query endpoints. Validate row count matches expectations after.

### Phase 6 — Paginated queries via RPC (mysticat-data-service)

The multi-step JS approach in Phase 4 materializes all matching IDs before slicing a page, which is acceptable for small-to-medium result sets but breaks down at scale. The correct long-term solution is a PostgreSQL RPC per query, moving the JOIN + LIMIT/OFFSET into a single SQL statement.

RPC migrations follow the existing convention (e.g., `2026-03-17-rpc_brand_presence_topics`). Each function is `CREATE OR REPLACE` so it is safe to iterate.

#### `rpc_suggestions_by_opp_and_url_prefix` (Query 2)

```sql
CREATE OR REPLACE FUNCTION rpc_suggestions_by_opp_and_url_prefix(
    p_opportunity_id uuid,
    p_url_prefix     text,
    p_limit          int DEFAULT 20,
    p_offset         int DEFAULT 0
)
RETURNS SETOF suggestions
LANGUAGE sql STABLE AS $$
    SELECT DISTINCT s.*
    FROM suggestions s
    JOIN suggestion_urls su ON su.suggestion_id = s.id
    WHERE su.opportunity_id = p_opportunity_id
      AND su.url_normalized LIKE p_url_prefix || '%'
    ORDER BY s.rank ASC, s.id
    LIMIT p_limit OFFSET p_offset;
$$;
```

Index used: `idx_suggestion_urls_opp_normalized (opportunity_id, url_normalized text_pattern_ops)` — the composite index covers both the equality and prefix filters in one B-tree scan. `DISTINCT` collapses duplicates from suggestions with multiple matching URLs.

#### `rpc_opportunities_by_site_and_url_prefix` (Query 1)

```sql
CREATE OR REPLACE FUNCTION rpc_opportunities_by_site_and_url_prefix(
    p_site_id    uuid,
    p_url_prefix text,
    p_limit      int DEFAULT 20,
    p_offset     int DEFAULT 0
)
RETURNS SETOF opportunities
LANGUAGE sql STABLE AS $$
    SELECT DISTINCT o.*
    FROM opportunities o
    JOIN suggestion_urls su ON su.opportunity_id = o.id
    WHERE o.site_id = p_site_id
      AND su.url_normalized LIKE p_url_prefix || '%'
    ORDER BY o.updated_at DESC, o.id
    LIMIT p_limit OFFSET p_offset;
$$;
```

The planner will choose between two strategies depending on data distribution:
- Scan `opportunities` by `site_id` (idx_opportunities_site_id), probe `suggestion_urls` per opportunity using the composite index — preferred when the site has few opportunities
- Scan `suggestion_urls` by `url_normalized` prefix (idx_suggestion_urls_normalized), hash join with `opportunities` filtered by `site_id` — preferred when the URL prefix is highly selective

`EXPLAIN ANALYZE` should be run on production data to confirm the planner picks the right strategy. A compound index on `suggestion_urls (url_normalized text_pattern_ops, opportunity_id)` can be added if the second strategy dominates and needs improvement.

#### `rpc_fix_entities_by_opp_and_url_prefix` (Query 3)

Fix entities require an additional hop through `fix_entity_suggestions` and must be ordered by `fix_entity_created_at`. A CTE cleanly separates the matching step from the fetch:

```sql
CREATE OR REPLACE FUNCTION rpc_fix_entities_by_opp_and_url_prefix(
    p_opportunity_id uuid,
    p_url_prefix     text,
    p_limit          int DEFAULT 20,
    p_offset         int DEFAULT 0
)
RETURNS SETOF fix_entities
LANGUAGE sql STABLE AS $$
    WITH matched AS (
        SELECT DISTINCT ON (fe.id)
            fe.id,
            fes.fix_entity_created_at
        FROM fix_entities fe
        JOIN fix_entity_suggestions fes ON fes.fix_entity_id = fe.id
        JOIN suggestion_urls su         ON su.suggestion_id  = fes.suggestion_id
        WHERE fes.opportunity_id = p_opportunity_id
          AND su.url_normalized LIKE p_url_prefix || '%'
        ORDER BY fe.id, fes.fix_entity_created_at ASC
    )
    SELECT fe.*
    FROM fix_entities fe
    JOIN matched ON matched.id = fe.id
    ORDER BY matched.fix_entity_created_at ASC, fe.id
    LIMIT p_limit OFFSET p_offset;
$$;
```

`DISTINCT ON (fe.id)` deduplicates fix entities that are linked to multiple matching suggestions, keeping the earliest `fix_entity_created_at` for ordering. The outer `ORDER BY` then sorts the final page correctly.

Index path: `idx_suggestion_urls_opp_normalized` → join to `fix_entity_suggestions` using `idx_fix_entity_suggestions_opportunity_id` (already exists).

#### `rpc_opportunities_by_url_prefix` (Query 4 — SHM)

```sql
CREATE OR REPLACE FUNCTION rpc_opportunities_by_url_prefix(
    p_url_prefix text,
    p_limit      int DEFAULT 20,
    p_offset     int DEFAULT 0
)
RETURNS SETOF opportunities
LANGUAGE sql STABLE AS $$
    SELECT DISTINCT o.*
    FROM opportunities o
    JOIN suggestion_urls su ON su.opportunity_id = o.id
    WHERE su.url_normalized LIKE p_url_prefix || '%'
    ORDER BY o.updated_at DESC, o.id
    LIMIT p_limit OFFSET p_offset;
$$;
```

Index used: `idx_suggestion_urls_normalized (url_normalized text_pattern_ops)` — unscoped prefix scan across all opportunities. Result set can be large depending on the prefix specificity; callers should pass a narrow prefix or use pagination aggressively.

#### Companion count functions

Each RPC needs a `_count` variant for the API to return total results alongside the page:

```sql
CREATE OR REPLACE FUNCTION rpc_suggestions_by_opp_and_url_prefix_count(
    p_opportunity_id uuid,
    p_url_prefix     text
)
RETURNS bigint
LANGUAGE sql STABLE AS $$
    SELECT COUNT(DISTINCT s.id)
    FROM suggestions s
    JOIN suggestion_urls su ON su.suggestion_id = s.id
    WHERE su.opportunity_id = p_opportunity_id
      AND su.url_normalized LIKE p_url_prefix || '%';
$$;
```

Same pattern for the other two queries. The count query reuses the same indexes as the main RPC and runs in one round-trip.

#### Calling RPCs from the collection layer

PostgREST exposes RPCs at `/rpc/<function_name>`. The collection methods call them via `postgrestService.rpc(...)` and follow the **same `{ data, cursor }` contract** as every other paginated collection method in the codebase (`allBySiteIdAndAuditType`, `allBySiteIdEnabled`, etc.). There is no `total` field — callers receive a cursor that is `null` when no more pages exist.

```js
// suggestion.collection.js
async allByOpportunityIdAndUrlPrefix(opportunityId, urlPrefix, options = {}) {
  if (!hasText(opportunityId)) throw new DataAccessError('opportunityId is required', this);
  if (!hasText(urlPrefix)) throw new DataAccessError('urlPrefix is required', this);

  const limit = Number.isInteger(options.limit) ? options.limit : DEFAULT_PAGE_SIZE;
  const offset = decodeCursor(options.cursor);
  const prefix = urlPrefix.replace(/^https?:\/\//, '');

  const { data, error } = await this.postgrestService.rpc(
    'rpc_suggestions_by_opp_and_url_prefix',
    {
      p_opportunity_id: opportunityId,
      p_url_prefix: prefix,
      p_limit: limit,
      p_offset: offset,
    },
  );

  if (error) throw new DataAccessError('URL prefix query failed', this);

  const rows = data || [];
  // Cursor is only set when a full page was returned — indicates more data exists.
  // Matches existing pattern in base.collection.js (lines 562-564).
  const cursor = rows.length === limit ? encodeCursor(offset + limit) : null;

  return {
    data: rows.map((r) => this.#toModelRecord(r)),
    cursor,
  };
}
```

Same pattern for the other two collection methods. No parallel count query — total is not part of the existing pagination contract.

---

## 7. Files Changed

| File | Change |
|------|--------|
| `mysticat-data-service/db/migrations/20260419120000_suggestion_urls.sql` | New |
| `spacecat-shared-data-access/src/models/base/schema.builder.js` | Add `withUrlExtractor` |
| `spacecat-shared-data-access/src/util/postgrest.utils.js` | `generatedFields` in `createFieldMaps` + `toDbRecord` guard |
| `spacecat-shared-data-access/src/models/base/base.collection.js` | `#syncEntityUrls` hook |
| `spacecat-shared-data-access/src/models/suggestion/suggestion.schema.js` | Register extractor |
| `spacecat-shared-data-access/src/models/suggestion/suggestion.collection.js` | Query 2 |
| `spacecat-shared-data-access/src/models/opportunity/opportunity.collection.js` | Query 1 |
| `spacecat-shared-data-access/src/models/fix-entity/fix-entity.collection.js` | Query 3 |
| `mysticat-data-service/db/migrations/YYYYMMDD_rpc_suggestions_by_opp_and_url_prefix.sql` | Phase 6 — RPC + count for Query 2 |
| `mysticat-data-service/db/migrations/YYYYMMDD_rpc_opportunities_by_site_and_url_prefix.sql` | Phase 6 — RPC + count for Query 1 |
| `mysticat-data-service/db/migrations/YYYYMMDD_rpc_opportunities_by_url_prefix.sql` | Phase 6 — RPC + count for Query 4 (SHM) |
| `mysticat-data-service/db/migrations/YYYYMMDD_rpc_fix_entities_by_opp_and_url_prefix.sql` | Phase 6 — RPC + count for Query 3 |

---

## 8. What We Are Not Doing

- **Not adding a `fix_entity_urls` table** — `suggestion_urls` already provides the URL index for fix entities via `fix_entity_suggestions`. Adding a second table would require a second sync trigger and duplicate data.
- **Not denormalizing `site_id` into `suggestion_urls`** (for now) — Query 1 resolves via a two-step approach; adding `site_id` would require fetching the opportunity's `site_id` during suggestion save (one extra round-trip). Deferred until a "suggestions by site + URL prefix" query is needed.
- **Not using a normalized URL registry** — a shared `urls` table requires an unscoped prefix scan followed by a join, which is slower than the denormalized composite index.
- **Not writing extraction logic in PL/pgSQL** — URL location is type-conditional and must stay in JS where it is testable and maintainable.

---

## 9. Open Questions

1. What are the actual JSON key names for URLs inside `suggestion.data`? Do they vary by `suggestion.type`? (Entity owner to confirm before Phase 3.)
2. Is the URL extractor logic the same for all suggestion types, or do some types not have URLs at all?
3. Is best-effort URL sync (write once, warn on failure) acceptable, or must query 2/3 guarantee freshness synchronously?
4. Should `fix_entity_created_at` ordering in Query 3 be ascending or descending by default?

---

## 10. Verification

| Check | How |
|-------|-----|
| Index is used | `EXPLAIN SELECT suggestion_id FROM suggestion_urls WHERE opportunity_id = X AND url_normalized LIKE 'example.com%'` → must show `Index Scan using idx_suggestion_urls_opp_normalized` |
| Extractor fires on save | Save a suggestion with a URL in `data`; assert row exists in `suggestion_urls` with correct `url_normalized` |
| Sync failure is non-fatal | Mock PostgREST URL sync to fail — assert warning is logged, entity save still returns successfully |
| Query 1 correctness | `allBySiteIdAndUrlPrefix` returns only opportunities with ≥1 suggestion URL matching prefix |
| Query 2 correctness | `allByOpportunityIdAndUrlPrefix` returns only suggestions whose URL starts with prefix |
| Query 3 ordering | `allByOpportunityIdAndUrlPrefix` on FixEntity returns results in `fixEntityCreatedAt` order |
| RPC pagination | `EXPLAIN ANALYZE rpc_suggestions_by_opp_and_url_prefix(...)` confirms index scan, not seq scan |
| RPC count accuracy | Count RPC returns same total as `SELECT COUNT(DISTINCT id)` from a manual query |
| RPC + multi-step parity | Both return identical result sets for the same inputs |
| Query 4 correctness | `allByUrlPrefix` returns opportunities across all sites whose suggestions match the prefix; result is not scoped to any single site |

---

## Review Feedback Log

| Date | Reviewer | Finding | Disposition |
|------|----------|---------|-------------|
|  |  |  |  |
