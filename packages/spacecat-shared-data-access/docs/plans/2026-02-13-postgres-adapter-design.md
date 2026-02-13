# Design: PostgreSQL Adapter for spacecat-shared-data-access

**JIRA:** SITES-39598
**Date:** 2026-02-13
**Status:** Draft
**Author:** DJ (with brainstorm team)

## Objective

Add a PostgreSQL adapter to `@adobe/spacecat-shared-data-access` that routes data operations through `mysticat-data-service` (PostgREST) instead of DynamoDB/ElectroDB. The public data access API must not change. A feature flag switches between backends at initialization time.

## Background

### Current State

- **spacecat-shared-data-access v2** uses ElectroDB to access DynamoDB directly
- 30+ entities in a single-table design with composite keys and GSIs
- `BaseCollection` and `BaseModel` are deeply coupled to ElectroDB APIs
- `ConfigurationCollection` is a standalone S3-based implementation (does not extend BaseCollection)
- `DATASTORE_TYPE` enum already exists with `DYNAMO` and `S3` values

### Target State

- **mysticat-data-service** is a PostgREST-based REST API over Aurora PostgreSQL
- 38+ tables with proper FKs, UUIDv7 PKs, snake_case columns
- TypeScript client via `@supabase/postgrest-js` with generated types from `@mysticat/data-service-types`
- No application code - PostgREST auto-generates CRUD endpoints from the PostgreSQL schema
- Currently no authentication (WAF IP restriction only)

### Prerequisites (completed)

- SITES-39582: TypeScript client generation from OpenAPI (Closed/Done)
- SITES-39579: OpenAPI specification (Closed/Done)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Abstraction boundary | Maximum isolation - separate code paths | Existing DynamoDB code untouched. No risk of breaking v2 consumers. |
| Model layer | New PostgresBaseModel hierarchy | Identical public API (getters, setters, save, remove, relationship accessors). Full isolation. |
| Schema mapping | Postgres-specific schema files per entity | Explicit table/column/FK mappings. No convention-based guessing. |
| HTTP client | `@supabase/postgrest-js` + `@mysticat/data-service-types` | Matches mysticat-data-service's recommended client pattern. Typed queries. |
| Relationship accessors | Separate queries (not PostgREST embedding) | Matches DynamoDB behavior. Predictable. Avoids subtle differences. |
| Configuration entity | Migrate from S3 to PostgreSQL | Full migration - all entities go through one backend. |
| Phasing | All entities at once | Entities share patterns - later ones go faster. Delivers full feature flag capability. |
| Integration tests | Same tests, two backends | IT tests ARE the public API contract. Running against both backends proves the adapter works. |

## Architecture

```
createDataAccess(config, log)
  |
  |-- DATA_ACCESS_BACKEND=dynamodb (default)
  |     -> EntityRegistry
  |          -> BaseCollection / BaseModel
  |               -> ElectroDB -> DynamoDB
  |
  |-- DATA_ACCESS_BACKEND=postgresql
        -> PostgresEntityRegistry
             -> PostgresBaseCollection / PostgresBaseModel
                  -> @supabase/postgrest-js
                       -> mysticat-data-service (PostgREST)
                            -> Aurora PostgreSQL
```

Two completely independent code paths. The feature flag is checked once at initialization, not per-request. Both paths return an object with identical keys and identical method signatures.

## Feature Flag

```js
// src/service/index.js
export function createDataAccess(config, log, client) {
  const backend = process.env.DATA_ACCESS_BACKEND || 'dynamodb';

  if (backend === 'postgresql') {
    return createPostgresDataAccess(config, log);
  } else if (backend === 'dynamodb') {
    return createDynamoDataAccess(config, log, client);
  } else {
    throw new Error(
      `Invalid DATA_ACCESS_BACKEND: "${backend}". Must be "dynamodb" or "postgresql".`
    );
  }
}
```

### Environment Variables

**Existing (DynamoDB path):**
- `DYNAMO_TABLE_NAME_DATA` - DynamoDB table name
- `S3_CONFIG_BUCKET` - S3 bucket for Configuration
- `AWS_REGION` - AWS region

**New (PostgreSQL path):**
- `DATA_ACCESS_BACKEND=postgresql` - Activates PostgreSQL adapter
- `DATA_SERVICE_URL` - PostgREST base URL (e.g., `https://dql63ofcyt4dr.cloudfront.net`)
- `DATA_SERVICE_API_KEY` - API key for authentication (optional, for future use)

## Package Structure (new files only)

```
src/
  service/
    index.js                              # Modified: feature flag switch
    postgres/
      postgres-entity-registry.js         # Builds and returns Postgres collections
      postgres-client.js                  # postgrest-js client setup (base URL, headers, keep-alive)

  models/
    postgres/
      base/
        postgres-base.model.js            # Identical public API to BaseModel
        postgres-base.collection.js       # Identical public API to BaseCollection
        postgres-patcher.js               # Tracks changes, emits PATCH via PostgREST

      # One directory per entity (30+ entities):
      site/
        site.pg.model.js                  # Extends PostgresBaseModel, adds domain methods
        site.pg.collection.js             # Extends PostgresBaseCollection, adds query methods
        site.pg.schema.js                 # Explicit table/column/FK/index mapping
      organization/
        organization.pg.model.js
        organization.pg.collection.js
        organization.pg.schema.js
      audit/
        audit.pg.model.js
        audit.pg.collection.js
        audit.pg.schema.js
      ... (all remaining entities follow the same pattern)
      configuration/
        configuration.pg.collection.js    # Migrated from S3 to PostgreSQL

  transformers/
    case-transformer.js                   # camelCase <-> snake_case utilities
    attribute-transformer.js              # Per-entity attribute mapping using pg.schema
    response-transformer.js               # PostgREST response -> model-compatible shape
```

## Postgres Schema Format

Each entity gets a `.pg.schema.js` file with explicit mappings:

```js
// site.pg.schema.js
export default {
  tableName: 'sites',
  primaryKey: 'id',

  // JS attribute name -> Postgres column name
  columns: {
    id: 'id',
    baseURL: 'base_url',
    deliveryType: 'delivery_type',
    organizationId: 'org_id',
    projectId: 'project_id',
    isLive: 'is_live',
    isLiveToggled: 'is_live_toggled',
    config: 'config',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    updatedBy: 'updated_by',
    // ... all attributes explicitly mapped
  },

  // Relationship definitions
  references: {
    belongs_to: [
      { entity: 'Organization', foreignKey: 'org_id', jsKey: 'organizationId' },
      { entity: 'Project', foreignKey: 'project_id', jsKey: 'projectId' },
    ],
    has_many: [
      { entity: 'Audit', foreignKey: 'site_id' },
      { entity: 'Opportunity', foreignKey: 'site_id' },
      { entity: 'Experiment', foreignKey: 'site_id' },
      { entity: 'KeyEvent', foreignKey: 'site_id' },
      { entity: 'LatestAudit', foreignKey: 'site_id' },
      { entity: 'SiteCandidate', foreignKey: 'site_id' },
      { entity: 'SiteEnrollment', foreignKey: 'site_id' },
      { entity: 'SiteTopForm', foreignKey: 'site_id' },
      { entity: 'SiteTopPage', foreignKey: 'site_id' },
      { entity: 'PageIntent', foreignKey: 'site_id' },
      { entity: 'PageCitability', foreignKey: 'site_id' },
    ],
    has_one: [
      { entity: 'LatestAudit', foreignKey: 'site_id', sortKey: 'audit_type' },
    ],
    removeDependents: ['Opportunity', 'Audit', 'Experiment'],
  },

  // Index-based query method definitions
  indexes: {
    allByOrganizationId: { column: 'org_id', param: 'organizationId' },
    allByDeliveryType: { column: 'delivery_type', param: 'deliveryType' },
    // ... one entry per auto-generated query method
  },

  // Entity behavior flags
  immutable: false,  // true for Audit (no UPDATE/DELETE)
};
```

## Data Flow

### Read: `dataAccess.site.findById('abc-123')`

```
PostgresSiteCollection.findById('abc-123')
  -> postgrestClient.from('sites').select('*').eq('id', 'abc-123').single()
  -> PostgREST returns: { id, base_url, org_id, delivery_type, ... }
  -> responseTransformer: snake_case -> camelCase using pg.schema.columns
     { id, baseURL, organizationId, deliveryType, ... }
  -> new PostgresSiteModel(transformedRecord, collectionRef)
  -> returns model with getId(), getBaseURL(), setBaseURL(), save(), remove(), etc.
```

### Write: `site.setBaseURL('https://new.com'); await site.save()`

```
site.setBaseURL('https://new.com')
  -> PostgresPatcher records: { baseURL: 'https://new.com' }

site.save()
  -> PostgresPatcher.flush()
  -> attributeTransformer: { baseURL: 'https://new.com' } -> { base_url: 'https://new.com' }
  -> postgrestClient.from('sites').update({ base_url: 'https://new.com' }).eq('id', site.getId())
  -> PostgREST returns updated record
  -> responseTransformer: update model's internal state
```

### Create: `dataAccess.site.create({ baseURL: 'https://example.com', organizationId: 'org-1' })`

```
PostgresSiteCollection.create(data)
  -> attributeTransformer: camelCase -> snake_case
  -> postgrestClient.from('sites').insert({ base_url, org_id, ... }).select().single()
  -> responseTransformer: snake_case -> camelCase
  -> new PostgresSiteModel(transformedRecord, collectionRef)
```

### Relationship: `site.getOrganization()`

```
site.getOrganization()
  -> check accessor cache -> miss
  -> registry.getCollection('Organization').findById(site.getOrganizationId())
  -> PostgresOrganizationCollection.findById(orgId)
  -> returns PostgresOrganizationModel
  -> cache result for subsequent calls
```

### Delete: `site.remove()`

```
site.remove()
  -> resolve removeDependents from pg.schema.references
  -> for each dependent entity: collection.removeByForeignKey(site.getId())
     -> postgrestClient.from('opportunities').delete().eq('site_id', siteId)
     -> postgrestClient.from('audits').delete().eq('site_id', siteId)
     -> ...
  -> postgrestClient.from('sites').delete().eq('id', siteId)
```

## PostgresBaseCollection API

Implements the same public API as `BaseCollection`:

| Method | PostgREST equivalent |
|--------|---------------------|
| `all(sortKeys?, options?)` | `GET /table?order=created_at.desc&limit=N` |
| `findById(id)` | `GET /table?id=eq.{id}&select=*` (single) |
| `existsById(id)` | `GET /table?id=eq.{id}&select=id` (check count) |
| `findByAll(sortKeys?, options?)` | `GET /table?order=...&limit=1` |
| `allByIndexKeys(keys, options?)` | `GET /table?col1=eq.val1&col2=eq.val2` |
| `findByIndexKeys(keys, options?)` | Same as above with `limit=1` |
| `batchGetByKeys(keys, options?)` | `GET /table?id=in.(id1,id2,...)` |
| `create(item, {upsert?})` | `POST /table` (with `Prefer: resolution=merge-duplicates` for upsert) |
| `createMany(items, parent?)` | `POST /table` with array body |
| `removeByIds(ids)` | `DELETE /table?id=in.(id1,id2,...)` |
| `removeByIndexKeys(keys)` | `DELETE /table?col1=eq.val1&col2=eq.val2` |

**Auto-generated methods** (from `pg.schema.indexes`):
| Method | PostgREST equivalent |
|--------|---------------------|
| `allByOrganizationId(orgId)` | `GET /table?org_id=eq.{orgId}` |
| `findByImsOrgId(imsOrgId)` | `GET /table?ims_org_id=eq.{imsOrgId}&limit=1` |
| `allByDeliveryType(type)` | `GET /table?delivery_type=eq.{type}` |
| `allBySiteIdAndStatus(siteId, status)` | `GET /table?site_id=eq.{siteId}&status=eq.{status}` |

## PostgresBaseModel API

Implements the same public API as `BaseModel`:

| Method | Implementation |
|--------|---------------|
| `getId()`, `getCreatedAt()`, `getUpdatedAt()` | Read from internal record |
| `getXxx()` (per attribute) | Auto-generated getter from pg.schema.columns |
| `setXxx(value)` (per attribute) | Auto-generated setter, records change in PostgresPatcher |
| `save()` | PostgresPatcher flushes changes via PATCH |
| `remove()` | Cascade dependents, then DELETE |
| `getOrganization()` (belongs_to) | Separate query via collection, cached |
| `getAudits()` (has_many) | Separate query via collection, cached |
| `getLatestAudit()` (has_one) | Separate query via collection, cached |
| `toJSON()` | Serialize all attributes to plain object (camelCase) |

## Transformers

### case-transformer.js

Utility functions for name conversion:

```js
camelToSnake('baseURL')       // -> 'base_url'
snakeToCamel('base_url')      // -> 'baseUrl' (note: special cases needed)
```

Note: some mappings are not purely mechanical (e.g., `baseURL` -> `base_url` not `base_u_r_l`). The pg.schema column maps handle these explicitly, so the case transformer is a fallback utility, not the primary mapping mechanism.

### attribute-transformer.js

Uses the pg.schema `columns` map to transform attribute names between JS and Postgres:

```js
// Outbound (JS -> Postgres)
transformToPostgres(schema, { baseURL: 'https://...', organizationId: 'org-1' })
// -> { base_url: 'https://...', org_id: 'org-1' }

// Inbound (Postgres -> JS)
transformFromPostgres(schema, { base_url: 'https://...', org_id: 'org-1' })
// -> { baseURL: 'https://...', organizationId: 'org-1' }
```

### response-transformer.js

Handles PostgREST response specifics:
- Array responses (from queries) -> array of transformed records
- Single responses (from `.single()`) -> transformed record
- Error responses -> appropriate exceptions matching existing error behavior
- Null/empty responses -> null (matching DynamoDB behavior)

## PostgresEntityRegistry

```js
// src/service/postgres/postgres-entity-registry.js

class PostgresEntityRegistry {
  #collections = {};
  #client;       // postgrest-js client
  #config;
  #log;

  constructor(client, config, log) { ... }

  initialize() {
    // Register all Postgres collections
    this.#register('site', new PostgresSiteCollection(this.#client, this, siteSchema, this.#log));
    this.#register('organization', new PostgresOrgCollection(this.#client, this, orgSchema, this.#log));
    this.#register('configuration', new PostgresConfigCollection(this.#client, this, configSchema, this.#log));
    // ... all 30+ entities
  }

  getCollection(entityName) {
    return this.#collections[entityName];
  }

  getCollections() {
    // Returns same shape as EntityRegistry.getCollections()
    return { ...this.#collections };
  }
}
```

## Integration Tests

### Principle: Same tests, two backends

The existing IT tests are the public API contract. They run against both backends to prove the PostgreSQL adapter produces identical behavior.

### What changes

| File | Change |
|------|--------|
| `test/it/fixtures.js` | Check `DATA_ACCESS_BACKEND`; start DynamoDB Local or Docker Compose |
| `test/it/util/seed.js` | Delegate to DynamoDB seeding or Postgres seeding based on flag |
| `test/it/util/seed-postgres.js` | New: seeds test data via PostgREST HTTP calls |
| `test/it/util/docker-compose.yml` | New: PostgreSQL + mysticat-data-service Docker image |
| `test/it/**/*.test.js` | **UNCHANGED** - same assertions, same API calls |

### How it works

```
CI Pipeline:
  1. npm run test:it                                    # DynamoDB (default)
  2. DATA_ACCESS_BACKEND=postgresql npm run test:it      # PostgreSQL
```

- `fixtures.js` conditionally starts DynamoDB Local (Java) or Docker Compose (PostgreSQL + PostgREST)
- `seed.js` routes to the appropriate seeding mechanism
- `getDataAccess()` picks up the env var and returns the correct backend
- All `*.test.js` files run unchanged against both backends

### Docker Compose for PostgreSQL IT

```yaml
# test/it/util/docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: mysticat
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"

  data-service:
    image: ghcr.io/adobe/mysticat-data-service:latest
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/mysticat
    ports:
      - "3000:3000"
```

Note: The mysticat-data-service Docker image already contains PostgREST + dbmate. On startup it runs migrations and starts PostgREST.

### What if a test passes on DynamoDB but fails on PostgreSQL?

That's an adapter bug - exactly what we want to catch. The fix goes in the Postgres adapter code, not in the test.

## Entity Coverage

All entities currently in the data access layer:

| Entity | Postgres Table | Notes |
|--------|---------------|-------|
| ApiKey | `api_keys` | |
| AsyncJob | `async_jobs` | |
| Audit | `audits` | Immutable (INSERT + SELECT only) |
| AuditUrl | `audit_urls` | |
| Configuration | `configurations` | Migrated from S3 to Postgres |
| Consumer | `consumers` | |
| Entitlement | `entitlements` | |
| Experiment | `experiments` | |
| FixEntity | `fix_entities` | |
| FixEntitySuggestion | `fix_entity_suggestions` | Junction table |
| ImportJob | `import_jobs` | |
| ImportUrl | `import_urls` | |
| KeyEvent | `key_events` | |
| LatestAudit | `latest_audits` | |
| Opportunity | `opportunities` | |
| Organization | `organizations` | |
| PageCitability | `page_citabilities` | |
| PageIntent | `page_intents` | |
| Project | `projects` | |
| Report | `reports` | |
| ScrapeJob | `scrape_jobs` | |
| ScrapeUrl | `scrape_urls` | |
| SentimentGuideline | `sentiment_guidelines` | |
| SentimentTopic | `sentiment_topics` | |
| Site | `sites` | Most complex entity |
| SiteCandidate | `site_candidates` | |
| SiteEnrollment | `site_enrollments` | |
| SiteTopForm | `site_top_forms` | |
| SiteTopPage | `site_top_pages` | |
| Suggestion | `suggestions` | |
| TrialUser | `trial_users` | |
| TrialUserActivity | `trial_user_activities` | |

## HTTP Client Configuration

```js
// src/service/postgres/postgres-client.js
import { PostgrestClient } from '@supabase/postgrest-js';

export function createPostgrestClient(config) {
  const baseUrl = config.dataServiceUrl || process.env.DATA_SERVICE_URL;
  const apiKey = config.dataServiceApiKey || process.env.DATA_SERVICE_API_KEY;

  const headers = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return new PostgrestClient(baseUrl, { headers });
}
```

Future considerations:
- Connection keep-alive (postgrest-js uses fetch, which handles this)
- Retry logic with exponential backoff (wrap client calls)
- Request timeouts
- Circuit breaker for service unavailability

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Schema drift between DynamoDB entities and Postgres tables | pg.schema files are explicit - mismatches surface as test failures |
| camelCase/snake_case mapping errors | Attribute transformer uses explicit per-entity column maps, not convention |
| PostgREST query behavior differs from ElectroDB | IT tests catch behavioral differences |
| HTTP overhead vs direct DynamoDB access | Performance benchmarks (JIRA deliverable). PostgREST is lightweight. |
| mysticat-data-service downtime affects all consumers | Feature flag enables instant rollback to DynamoDB |
| Configuration entity has no Postgres table yet | Requires new `configurations` table in mysticat-data-service |
| Some DynamoDB-specific query patterns may not map cleanly to PostgREST | Identify during implementation, document breaking changes |

## Out of Scope

- Authentication enforcement on mysticat-data-service (separate ticket)
- PostgREST embedding/join optimization (deferred - start with separate queries)
- Migration tooling for data transfer from DynamoDB to PostgreSQL (SITES-39750)
- Consumer (lambda) adaptation for v3 (SITES-39592)
- Maintenance window strategy (SITES-39585)

## Blocked By

- SITES-39582: TypeScript client generation from OpenAPI - **Done**
- SITES-39579: OpenAPI specification - **Done**
- `configurations` table must exist in mysticat-data-service before Configuration entity migration

## Blocks

- SITES-39585: Maintenance window strategy (uses feature flag for staged rollout)
- SITES-39592: Adapt spacecat lambdas for v3 data access layer
- SITES-39750: Execute data migration
