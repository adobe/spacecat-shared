# spacecat-shared-data-access

Shared data-access layer for SpaceCat services. Provides entity models/collections backed by PostgreSQL via PostgREST.

## Architecture

```
Lambda/ECS service
  -> this package (@adobe/spacecat-shared-data-access)
       -> @supabase/postgrest-js
            -> mysticat-data-service (PostgREST + Aurora PostgreSQL)
```

- **Database schema**: lives in [mysticat-data-service](https://github.com/adobe/mysticat-data-service) as dbmate SQL migrations
- **This package**: JavaScript model/collection layer mapping camelCase entities to snake_case PostgREST API
- **v2 (retired)**: ElectroDB -> DynamoDB. Published as `@adobe/spacecat-shared-data-access-v2`
- **v3 (current)**: PostgREST client -> mysticat-data-service

## Key Files

| File | Purpose |
|------|---------|
| `src/index.js` | Default export: `dataAccessWrapper(fn)` for Helix/Lambda handlers |
| `src/service/index.js` | `createDataAccess(config, log?, client?)` factory — returns entity collections + `services.postgrestClient` |
| `src/service/index.d.ts` | `DataAccess` and `DataAccessServices` type definitions |
| `src/models/base/schema.builder.js` | DSL for defining entity schemas (attributes, references, indexes) |
| `src/models/base/base.model.js` | Base entity class (auto-generated getters/setters, save, remove) |
| `src/models/base/base.collection.js` | Base collection class (findById, all, query, count) |
| `src/models/base/entity.registry.js` | Registers all entity collections |
| `src/util/postgrest.utils.js` | camelCase<->snake_case field mapping, query builders, cursor pagination |
| `src/models/index.js` | Barrel export of all entity models |

## Entity Structure

Each entity lives in `src/models/<entity>/` with 4 files:

```
src/models/site/
  site.schema.js       # SchemaBuilder definition (attributes, references, indexes)
  site.model.js        # Extends BaseModel (business logic, constants)
  site.collection.js   # Extends BaseCollection (custom queries)
  index.js             # Re-exports model, collection, schema
```

### Schema Definition Pattern

```js
const schema = new SchemaBuilder(Site, SiteCollection)
  .addReference('belongs_to', 'Organization')   // FK -> organizations.id
  .addReference('has_many', 'Audits')            // One-to-many relationship
  .addAttribute('baseURL', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  })
  .addAttribute('deliveryType', {
    type: Object.values(Site.DELIVERY_TYPES),     // Enum validation
    default: Site.DEFAULT_DELIVERY_TYPE,
    required: true,
  })
  .addAttribute('config', {
    type: 'any',
    default: DEFAULT_CONFIG,
    get: (value) => Config(value),                // Transform on read
  })
  .addAllIndex(['imsOrgId'])                      // Query index
  .build();
```

### Attribute Options

| Option | Purpose |
|--------|---------|
| `type` | `'string'`, `'number'`, `'boolean'`, `'any'`, `'map'`, or array of enum values |
| `required` | Validation on save |
| `default` | Default value or factory function |
| `validate` | Custom validation function |
| `readOnly` | No setter generated |
| `postgrestField` | Custom DB column name (default: `camelToSnake(name)`) |
| `postgrestIgnore` | Virtual attribute, not sent to DB |
| `hidden` | Excluded from `toJSON()` |
| `watch` | Array of field names that trigger this attribute's setter |
| `set` | Custom setter `(value, allAttrs) => transformedValue` |
| `get` | Custom getter `(value) => transformedValue` |

### Field Mapping

Models use camelCase, database uses snake_case. Mapping is automatic:

| Model field | DB column | Notes |
|-------------|-----------|-------|
| `siteId` (idName) | `id` | Primary key always maps to `id` |
| `baseURL` | `base_url` | Auto camelToSnake |
| `organizationId` | `organization_id` | FK from `belongs_to` reference |
| `isLive` | `is_live` | Auto camelToSnake |

Override with `postgrestField: 'custom_name'` on the attribute.

## Changing Entities

Changes require **two repos**:

### 1. Database schema — [mysticat-data-service](https://github.com/adobe/mysticat-data-service)

```bash
make migrate-new name=add_foo_to_sites
# Edit the migration SQL (table, columns, indexes, grants, comments)
make migrate && make test
```

Every migration must include: indexes on FKs, `GRANT` to `postgrest_anon`/`postgrest_writer`, `COMMENT ON` for OpenAPI docs. See [mysticat-data-service CLAUDE.md](https://github.com/adobe/mysticat-data-service/blob/main/CLAUDE.md).

### 2. Model layer — this package

- Add attribute in `<entity>.schema.js` -> auto-generates getter/setter
- Add business logic in `<entity>.model.js`
- Add custom queries in `<entity>.collection.js`
- New entity: create 4 files + register in `src/models/index.js`

### 3. Integration test

```bash
npm run test:it    # Spins up PostgREST via Docker, runs mocha suite
```

## Testing

```bash
npm test              # Unit tests (mocha + sinon + chai)
npm run test:debug    # Unit tests with debugger
npm run test:it       # Integration tests (Docker: Postgres + PostgREST)
npm run lint          # ESLint
npm run lint:fix      # Auto-fix lint issues
```

### Integration Test Setup

Integration tests pull the `mysticat-data-service` Docker image from ECR:

```bash
# ECR login (one-time)
aws ecr get-login-password --profile spacecat-dev --region us-east-1 \
  | docker login --username AWS --password-stdin 682033462621.dkr.ecr.us-east-1.amazonaws.com

# Override image tag
export MYSTICAT_DATA_SERVICE_TAG=v1.13.0
npm run test:it
```

### Unit Test Conventions

- Tests in `test/unit/models/<entity>/`
- PostgREST calls are stubbed via sinon
- Each entity model and collection has its own test file

## Direct PostgREST Queries

`dataAccess.services.postgrestClient` exposes the raw `@supabase/postgrest-js` `PostgrestClient` for querying tables that don't have entity models (e.g. analytics views, reporting tables):

```js
const { postgrestClient } = context.dataAccess.services;

const { data, error } = await postgrestClient
  .from('brand_presence_executions')
  .select('*')
  .eq('site_id', siteId)
  .limit(100);
```

This is the same client instance used internally by entity collections — same URL, auth, and schema.

## Common Patterns

### Collection query with WHERE clause

```js
// In a collection method
async findByStatus(status) {
  return this.all(
    (attrs, op) => op.eq(attrs.status, status),
    { limit: 100, order: { field: 'createdAt', direction: 'desc' } }
  );
}
```

### Reference traversal

```js
// belongs_to: site.getOrganization() -> fetches parent org
// has_many: organization.getSites() -> fetches child sites
const site = await dataAccess.Site.findById(id);
const org = await site.getOrganization();
const audits = await site.getAudits();
```

### PostgREST WHERE operators

`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `is`, `in`, `contains`, `like`, `ilike`

```js
// Usage in collection.all()
const liveSites = await dataAccess.Site.all(
  (attrs, op) => op.eq(attrs.isLive, true)
);
```

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `POSTGREST_URL` | Yes | PostgREST base URL (e.g. `http://data-svc.internal`) |
| `POSTGREST_SCHEMA` | No | Schema name (default: `public`) |
| `POSTGREST_API_KEY` | No | JWT for `postgrest_writer` role (enables UPDATE/DELETE) |
| `S3_CONFIG_BUCKET` | No | Only for `Configuration` entity |
| `AWS_REGION` | No | Only for `Configuration` entity |
| `STATUS_TRANSITION_ENFORCEMENT` | No | Status-transition guard mode: `off` \| `warn` \| `enforce`. Default `warn`. See "Status Transition Lifecycle". |

## Status Transition Lifecycle (SITES-47091)

`Suggestion.status` and `FixEntity.status` are governed by a transition guard
(canonical design: ADR [adobe/mysticat-architecture#174]). The guard runs on the
`setStatus` override of both models — so **every** writer (api-service single
PATCH, `SuggestionCollection.bulkUpdateStatus`, autofix-worker) is checked at one
chokepoint.

**Enforcement is env-controlled** via `STATUS_TRANSITION_ENFORCEMENT`, read at call time:

| Mode | Behavior |
|------|----------|
| `off` | no check |
| `warn` (**default**) | logs a violation (`<Entity> <id> <from> -> <to>`) and **still applies** the change — byte-equivalent to the old setter |
| `enforce` | throws `ValidationError` on a disallowed transition |

Rollout intent: ship `warn` to surface today's illegal transitions in logs for
~1–2 weeks, then flip to `enforce`. A no-op (`from === to`) always passes.

**APIs** (exported from the package root):
- `setStatus(value)` / `transitionStatus(to)` on `Suggestion` and `FixEntity` — both guard the transition; `transitionStatus` is the intention-revealing alias for new code.
- `isAllowedFixTransition(from, to)` / `isAllowedSuggestionTransition(from, to)` + the `FIX_ENTITY_TRANSITIONS` / `SUGGESTION_TRANSITIONS` tables (a null/undefined `from` means entity creation).
- `deriveSuggestionStatus(outcomes, issues = [], currentStatus = null)` — derives a Suggestion status from a per-suggestion list of **outcome signals**. Each entry is a FixEntity, `{status}`, or a status string from **either** vocabulary: FixEntity statuses (`DEPLOYED`/`PUBLISHED`→FIXED, `FAILED`→ERROR, `PENDING`→IN_PROGRESS, `ROLLED_BACK`/`REJECTED`→SKIPPED) **or** explicit Suggestion-status outcomes a handler asserts for no-fix cases (e.g. consciously skipped → `'SKIPPED'`, not-actionable → `'NEW'`). Signals are classified via `classifyStatus` and collapsed **first-match-wins by severity: ERROR > IN_PROGRESS > FIXED > SKIPPED**; all-NEUTRAL (e.g. only `NEW`) → `NEW`; no recognized signals → `currentStatus` (default null, so a derive call never clobbers a status set elsewhere). **Throws** if a non-empty `issues` array is passed — the CWV multi-issue bubble-up is deferred (SITES-47285): the per-issue codefix vocabulary (`PATCH_*`/`GUIDANCE_GENERATED`, written by mystique into the overloaded `issue.status` field) is not yet reconciled with the JS layer.
- `classifyStatus(token)` — maps a fix- or suggestion-status token to its severity class (`ERROR`/`IN_PROGRESS`/`FIXED`/`SKIPPED`/`NEUTRAL`) or `null`. The shared building block behind the bubble-up; consumers building custom collapses should reuse it rather than re-encode the mapping.

Notes: the `FixEntity` table is the canonical one from the ADR; the `Suggestion`
table is intentionally **permissive in V1** (tune it from the warn-log findings
before enforcing). `FixEntity.REJECTED` is omitted (not in `FixEntity.STATUSES`).
Consumer adoption (bump + route writes + warn→enforce) is tracked in SITES-47286.

[adobe/mysticat-architecture#174]: https://github.com/adobe/mysticat-architecture/blob/main/platform/decisions/design-suggestion-fix-entity-status-lifecycle.md

## Deploy-action `changeDetails` v2 (SITES-47997)

`FixEntity.changeDetails` has a canonical **v2 shape** — the structured,
validated "deploy action" record (who/when/what/which-pages/result) from ADR
[adobe/mysticat-architecture#200]. It is defined in
`src/models/fix-entity/change-details.schema.js` (Joi) and wired into the
`changeDetails` attribute validator.

- **Reader-tolerant / additive.** The DB column stays `type: 'any'` — no
  migration. Records **without `schemaVersion: 2`** are legacy freeform (v1) and
  keep the old non-empty-object guard; only `schemaVersion: 2` records are
  schema-validated. This runs on the **create** path (`#validateItem` →
  `collection.create`), not on `save()` updates.
- **Shape.** `{ schemaVersion: 2, surface, actorType, target, result? }`.
  `target` = the proposal (intent): `changeType` + `changes[{ targetPath,
  property, intendedValue }]`. `result` = the outcome: `callStatus`
  (`success|no_op|client_error|server_error|timeout`), `applied`
  (**enum `ALL|PARTIAL|NONE`, not a boolean**), `changeResults[]` (key-matched to
  `target.changes` by `(targetPath, property)`), `pre/postVerify` verdicts, and
  `deployResponsePayload` (**≤ 4 KB cap**) + `deployResponseSha256` (hex).
- **APIs** (exported from the package root):
  - `validateChangeDetails(value)` — the attribute validator; `false` on a
    non-object, `true` for legacy/valid-v2, **throws** with a descriptive message
    on an invalid v2 record.
  - `changeDetailsV2Schema` — the raw Joi `ObjectSchema` (strict; unknown keys
    rejected) for consumers that want to validate directly.
  - `FixEntity.CHANGE_DETAILS` — the enum bundle (`SURFACES`, `ACTOR_TYPES`,
    `CALL_STATUSES`, `APPLIED`, `CHANGE_RESULT_STATUSES`, `VERIFY_VERDICTS`,
    `SCHEMA_VERSION`, `DEPLOY_RESPONSE_PAYLOAD_MAX_BYTES`). Kept on the model
    (not the barrel) to avoid collisions on these generic names.
- **Not yet done** (tracked on SITES-47997): the `publishedBy` column +
  `executedBy/At` → `deployedBy/At` rename (dual-write, needs a companion
  mysticat-data-service migration), and gating the `DEPLOYED`/`PUBLISHED`
  transition on `result` presence (extends the SITES-47091 guard).

[adobe/mysticat-architecture#200]: https://github.com/adobe/mysticat-architecture/blob/main/platform/decisions/deploy-action-provenance-and-verify.md

## Site Config: Import Types

Site configuration lives in `src/models/site/config.js` and defines the available import types, their validation schemas, and default configs. This is one of the most frequently changed files in the package.

### Adding a New Import Type

Update three locations in `src/models/site/config.js`:

**1. Add the constant to `IMPORT_TYPES`:**

```js
export const IMPORT_TYPES = {
  // ... existing types
  MY_NEW_IMPORT: 'my-new-import',
};
```

**2. Add the Joi validation schema to `IMPORT_TYPE_SCHEMAS`:**

```js
export const IMPORT_TYPE_SCHEMAS = {
  // ... existing schemas
  [IMPORT_TYPES.MY_NEW_IMPORT]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.MY_NEW_IMPORT).required(),
    ...IMPORT_BASE_KEYS,
    // Add optional type-specific fields here (e.g., geo, limit, year, week)
  }),
};
```

`IMPORT_BASE_KEYS` includes `enabled`, `destinations`, and `sources`. Only add extra fields if the import type needs them.

**3. Add the default config to `DEFAULT_IMPORT_CONFIGS`:**

```js
export const DEFAULT_IMPORT_CONFIGS = {
  // ... existing defaults
  'my-new-import': {
    type: 'my-new-import',
    destinations: ['default'],
    sources: ['rum'],   // or 'ahrefs', 'google'
    enabled: true,
  },
};
```

### Test Updates

In `test/unit/models/site/config.test.js`, add:

1. **Enable import test** — verify `config.enableImport('my-new-import')` produces the expected default config
2. **Validation error string** — the long `.to.equal(...)` assertion for invalid import type errors must include the new type
3. **Validation error details** — the `.to.eql([...])` array of expected error detail objects must include the new type

### Available Sources

| Source | Constant | Used by |
|--------|----------|---------|
| `'ahrefs'` | `IMPORT_SOURCES.AHREFS` | Keyword, traffic, backlink imports |
| `'google'` | `IMPORT_SOURCES.GSC` | Google Search Console imports |
| `'rum'` | `IMPORT_SOURCES.RUM` | RUM/CWV/engagement imports |

---

## Special Entities

- **Configuration**: S3-backed (not PostgREST). Requires `S3_CONFIG_BUCKET`.
- **KeyEvent**: Deprecated in v3. All methods throw.
- **LatestAudit**: Virtual entity computed from `Audit` queries (no dedicated table).