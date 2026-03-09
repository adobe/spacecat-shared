# Changes Required: Token Schema (Postgres) in spacecat-shared-data-access

The **mysticat-data-service** now has a Postgres `tokens` table and RPC `increment_token_used`. The current **Token** model in this repo is still written for **ElectroDB/DynamoDB** (`entity.get()`, `token.save()`). To use the new Postgres schema, the following changes are required in the **current branch** (spacecat-shared).

---

## 1. Postgres contract (reference)

- **Table:** `tokens`
- **Columns:** `site_id` (uuid), `token_type` (text), `cycle` (text), `total` (int), `used` (int, default 0), `created_at`, `updated_at`, `updated_by`
- **Primary key:** `(site_id, token_type, cycle)`
- **RPC:** `increment_token_used(p_site_id uuid, p_token_type text, p_cycle text, p_amount int DEFAULT 1)`  
  - Returns `SETOF tokens` (one row if updated, empty if no row or would exceed `total`).  
  - Call: `POST /rpc/increment_token_used` with body  
    `{ "p_site_id": "<uuid>", "p_token_type": "<type>", "p_cycle": "<cycle>", "p_amount": 1 }`.

---

## 2. Token schema (`token.schema.js`)

**Goals:** Map to Postgres columns; support composite primary key; no single `id` column in DB.

- **Primary key:** Keep composite primary index:  
  `withPrimaryPartitionKeys(['siteId', 'tokenType']).withPrimarySortKeys(['cycle'])`.
- **Attributes:** Ensure Postgres column mapping:
  - `siteId` → `site_id` (e.g. `postgrestField: 'site_id'`), required.
  - `tokenType` → `token_type` (e.g. `postgrestField: 'token_type'`), required.
  - `cycle`, `total`, `used`, `createdAt`, `updatedAt`, `updatedBy` with correct types and, if needed, `postgrestField` for snake_case.
- **Id attribute:** The table has no `id` column. Either:
  - Add `tokenId` with `postgrestIgnore: true` so it is not sent to/from PostgREST (may require a small SchemaBuilder change to allow ignoring the default id), or
  - Extend SchemaBuilder to support “composite PK only” entities that do not add the default id attribute.
- **Reference:** Keep `addReference('belongs_to', 'Site', ...)` if the rest of the stack expects it; ensure it does not imply an `id` column in DB.
- **Token types:** Align with DB values (e.g. `suggestion_cwv`, `suggestion_broken_backlinks`). Either:
  - Set `Token.TOKEN_TYPES` to these strings, or
  - Keep existing enum and map in the collection when calling PostgREST/RPC.

---

## 3. Token collection (`token.collection.js`)

**Goals:** Use only PostgREST (no ElectroDB); support composite key lookup; use RPC for atomic consume.

- **Remove ElectroDB usage:** Remove all use of `this.entity` (e.g. `this.entity.get(...).go()`, `token.save()`). Use only `this.postgrestService` and `this.tableName` (`'tokens'`).
- **findById(siteId, tokenType, cycle):**  
  Use PostgREST:  
  `this.postgrestService.from(this.tableName).select(...).eq('site_id', siteId).eq('token_type', tokenType).eq('cycle', cycle).maybeSingle()`,  
  then build a Token instance from the result (e.g. via `this.#createInstance(this.#toModelRecord(data))` or equivalent). Do not call base `findById(id)` with a single id.
- **findBySiteIdAndTokenType(siteId, tokenType):**  
  Derives the current cycle from `getTokenGrantConfig(tokenType).cycleFormat` via `getCurrentCycle()`,
  then delegates to `findById(siteId, tokenType, cycle)`. Creates a new token if none exists for the current cycle.
- **getRemainingToken(siteId, tokenType, cycle):**  
  Unchanged in spirit: find the row (via the new find above), then return `total - used` (or 0 if not found). No ElectroDB.
- **useToken(siteId, tokenType, cycle):**  
  **Use the RPC instead of read-then-save:**
  - Call  
    `this.postgrestService.rpc('increment_token_used', { p_site_id: siteId, p_token_type: tokenType, p_cycle: cycle, p_amount: 1 })`.
  - If the RPC returns a row, return something like `{ tokenId: \`${siteId}#${tokenType}#${cycle}\`, cycle }`.
  - If it returns empty (no row or would exceed `total`), return `null`.
  - Remove the old flow that did find → increment `used` → `token.save()`.
- **create(item, { upsert: true }):**  
  Base `create()` uses a single `onConflict` field. Override **create** for Token when `upsert === true` to use composite conflict:  
  `onConflict: 'site_id,token_type,cycle'` (or the correct PostgREST form for composite upsert). Ensure the payload uses DB column names (`site_id`, `token_type`, `cycle`, `total`, `used`, etc.).

---

## 4. Token model (`token.model.js`)

- **Keep:** `getRemaining()`, and `TOKEN_TYPES` if still used by callers.
- **Align TOKEN_TYPES** with DB values (e.g. `suggestion_cwv`, `suggestion_broken_backlinks`) or keep current names and map only at the boundary (collection/API).
- **Remove or relax:** `generateCompositeKeys()` if it was only for ElectroDB; no need for ElectroDB-style key generation when using PostgREST.
- **No `save()` for consume:** Consume is done via RPC; the model does not need to persist `used` itself.

---

## 5. Base collection / schema (if needed)

- **Upsert (create with upsert):** Base uses `this.idName` for `onConflict`. For Token, either override `create()` in TokenCollection to use composite `onConflict`, or extend base to support a schema/option for “composite conflict columns” (e.g. from `getIndexKeys('primary')`).
- **findByIndexKeys:** With the schema’s primary index as `(siteId, tokenType, cycle)`, calling `findByIndexKeys({ siteId, tokenType, cycle }, { limit: 1 })` should already build the right `.eq(...)` chain via `#applyKeyFilters`. So `findById(siteId, tokenType, cycle)` can be implemented as `findByIndexKeys({ siteId, tokenType, cycle }, { limit: 1 })` if the schema and field maps are correct (and no ElectroDB `this.entity` path is taken).

---

## 6. Tests

- **Unit tests** (`token.collection.test.js`, `token.model.test.js`): Remove stubs of `entity.get`, `entity.put`, etc. Stub `postgrestService.from('tokens').select().eq(...).maybeSingle()` and `postgrestService.rpc('increment_token_used', ...)` instead. Assert correct RPC payload and return value (e.g. `null` when RPC returns empty).
- **Integration tests:** If any hit a real or mock PostgREST, point them at the `tokens` table and `increment_token_used` RPC; seed data should match the new schema (site_id, token_type, cycle, total, used).

---

## 7. Optional

- **Table name:** `entityToTableName('Token')` is already `'tokens'`; no change needed unless you use a different model name.
- **Exports:** Ensure `Token` and `TokenCollection` remain exported from the package so callers can use the new API unchanged aside from backend now being Postgres.

---

## Summary checklist

| Area              | Change |
|-------------------|--------|
| **token.schema.js** | Map to Postgres columns; composite PK; id not sent to DB (postgrestIgnore or no-id support). |
| **token.collection.js** | PostgREST-only: find by composite key, upsert with composite onConflict, use RPC for `useToken`. |
| **token.model.js** | Keep getRemaining/TOKEN_TYPES; align or map token types; drop ElectroDB-only helpers. |
| **Tests**         | Switch mocks from ElectroDB to PostgREST and RPC. |
| **Base**          | Optional: support composite onConflict in create so Token can reuse base upsert. |

These changes make the Token entity in this branch use the new Postgres token schema and the atomic `increment_token_used` RPC.
