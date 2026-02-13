# PostgreSQL Adapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a PostgreSQL adapter to spacecat-shared-data-access that routes through mysticat-data-service (PostgREST), controlled by a `DATA_ACCESS_BACKEND` feature flag, while keeping the existing DynamoDB path untouched.

**Architecture:** Two completely isolated code paths behind a feature flag checked once at initialization. The DynamoDB path (default) uses existing ElectroDB code. The PostgreSQL path uses new `PostgresBase*` classes that delegate to `@supabase/postgrest-js`. Both paths return objects with identical keys and method signatures.

**Tech Stack:** Node.js, `@supabase/postgrest-js`, `pluralize`, ElectroDB (existing), DynamoDB (existing), Docker Compose (for IT)

**Reference Material:** ED's branch `v3-postgrest-data-access` contains a working PostgREST-only implementation. Many utilities and patterns can be ported directly. Key files to reference:
- `src/util/postgrest.utils.js` - field mapping utilities (port wholesale)
- `src/models/base/base.collection.js` (on ED's branch) - PostgREST query patterns
- `src/models/base/base.model.js` (on ED's branch) - PostgREST model patterns
- `src/util/patcher.js` (on ED's branch) - PostgREST update logic
- `test/it/postgrest/` - Docker Compose + IT helpers

**Design Doc:** `docs/plans/2026-02-13-postgres-adapter-design.md`

---

## Task 1: Branch Setup and Dependencies

**Files:**
- Modify: `packages/spacecat-shared-data-access/package.json`
- Modify: `package-lock.json` (via npm install)

**Step 1: Create feature branch from main**

```bash
cd /Users/dj/adobe/github/adobe/spacecat-shared
git checkout main && git pull
git checkout -b dj/feat-postgres-adapter
```

**Step 2: Add postgrest-js dependency**

```bash
cd packages/spacecat-shared-data-access
npm install @supabase/postgrest-js@^1.21.4
```

**Step 3: Verify existing tests still pass**

```bash
npm test
```
Expected: All existing unit tests pass. No changes to runtime code yet.

**Step 4: Commit**

```bash
git add packages/spacecat-shared-data-access/package.json package-lock.json
git commit -m "chore(data-access): add @supabase/postgrest-js dependency"
```

---

## Task 2: PostgREST Utilities

Port ED's `postgrest.utils.js` - this provides the camelCase/snake_case field mapping that the entire Postgres path depends on.

**Files:**
- Create: `src/util/postgrest.utils.js`
- Create: `test/unit/util/postgrest.utils.test.js`

**Step 1: Write the tests**

```js
// test/unit/util/postgrest.utils.test.js
import { expect } from 'chai';
import {
  camelToSnake, snakeToCamel, entityToTableName,
  createFieldMaps, toDbRecord, fromDbRecord,
  encodeCursor, decodeCursor,
} from '../../../src/util/postgrest.utils.js';

describe('postgrest.utils', () => {
  describe('camelToSnake', () => {
    it('converts simple camelCase', () => {
      expect(camelToSnake('baseURL')).to.equal('base_url');
      expect(camelToSnake('organizationId')).to.equal('organization_id');
      expect(camelToSnake('isLive')).to.equal('is_live');
    });

    it('handles already-lowercase', () => {
      expect(camelToSnake('id')).to.equal('id');
      expect(camelToSnake('name')).to.equal('name');
    });
  });

  describe('snakeToCamel', () => {
    it('converts snake_case', () => {
      expect(snakeToCamel('base_url')).to.equal('baseUrl');
      expect(snakeToCamel('organization_id')).to.equal('organizationId');
    });
  });

  describe('entityToTableName', () => {
    it('pluralizes and converts', () => {
      expect(entityToTableName('Site')).to.equal('sites');
      expect(entityToTableName('Organization')).to.equal('organizations');
      expect(entityToTableName('Opportunity')).to.equal('opportunities');
      expect(entityToTableName('FixEntity')).to.equal('fix_entities');
    });

    it('handles overrides', () => {
      expect(entityToTableName('LatestAudit')).to.equal('audits');
    });
  });

  describe('createFieldMaps', () => {
    it('builds bidirectional maps from schema attributes', () => {
      const mockSchema = {
        getAttributes: () => ({
          baseURL: { postgrestField: 'base_url' },
          name: {},
          organizationId: {},
        }),
        getIdName: () => 'siteId',
      };
      const { toDbMap, toModelMap } = createFieldMaps(mockSchema);
      expect(toDbMap.baseURL).to.equal('base_url');
      expect(toDbMap.name).to.equal('name');
      expect(toDbMap.siteId).to.equal('id');
      expect(toModelMap.base_url).to.equal('baseURL');
      expect(toModelMap.id).to.equal('siteId');
    });
  });

  describe('toDbRecord / fromDbRecord', () => {
    it('transforms record keys', () => {
      const toDbMap = { baseURL: 'base_url', isLive: 'is_live' };
      const toModelMap = { base_url: 'baseURL', is_live: 'isLive' };

      const dbRecord = toDbRecord({ baseURL: 'https://x.com', isLive: true }, toDbMap);
      expect(dbRecord).to.deep.equal({ base_url: 'https://x.com', is_live: true });

      const modelRecord = fromDbRecord(dbRecord, toModelMap);
      expect(modelRecord).to.deep.equal({ baseURL: 'https://x.com', isLive: true });
    });
  });

  describe('cursor encoding', () => {
    it('round-trips', () => {
      const cursor = encodeCursor(42);
      expect(decodeCursor(cursor)).to.equal(42);
    });

    it('handles null/invalid', () => {
      expect(decodeCursor(null)).to.equal(0);
      expect(decodeCursor('garbage')).to.equal(0);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- --grep "postgrest.utils"
```
Expected: FAIL - module not found

**Step 3: Create the utility file**

Port from ED's branch: `git show v3-postgrest-data-access:packages/spacecat-shared-data-access/src/util/postgrest.utils.js`

Create `src/util/postgrest.utils.js` with the exact content from ED's implementation (camelToSnake, snakeToCamel, entityToTableName, createFieldMaps, toDbRecord, fromDbRecord, encodeCursor, decodeCursor, applyWhere, DEFAULT_PAGE_SIZE).

**Step 4: Run tests to verify they pass**

```bash
npm test -- --grep "postgrest.utils"
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/util/postgrest.utils.js test/unit/util/postgrest.utils.test.js
git commit -m "feat(data-access): add PostgREST field mapping utilities"
```

---

## Task 3: Feature Flag in createDataAccess

Add the `DATA_ACCESS_BACKEND` feature flag to the entry points. The PostgreSQL path will initially throw "not yet implemented" - we wire it up in Task 7.

**Files:**
- Modify: `src/service/index.js`
- Modify: `src/index.js`
- Modify: `test/unit/service/index.test.js`

**Step 1: Write the tests**

Add tests for the feature flag behavior:

```js
// In existing test file, add:
describe('DATA_ACCESS_BACKEND feature flag', () => {
  afterEach(() => {
    delete process.env.DATA_ACCESS_BACKEND;
  });

  it('defaults to dynamodb when not set', () => {
    const da = createDataAccess(validConfig, log);
    expect(da.site).to.be.an('object'); // existing DynamoDB collections
  });

  it('uses dynamodb when explicitly set', () => {
    process.env.DATA_ACCESS_BACKEND = 'dynamodb';
    const da = createDataAccess(validConfig, log);
    expect(da.site).to.be.an('object');
  });

  it('throws on invalid backend value', () => {
    process.env.DATA_ACCESS_BACKEND = 'invalid';
    expect(() => createDataAccess(validConfig, log))
      .to.throw('Invalid DATA_ACCESS_BACKEND');
  });

  it('creates postgres data access when postgresql', () => {
    process.env.DATA_ACCESS_BACKEND = 'postgresql';
    process.env.POSTGREST_URL = 'http://localhost:3000';
    const da = createDataAccess({ postgrestUrl: 'http://localhost:3000' }, log);
    expect(da.site).to.be.an('object');
  });
});
```

**Step 2: Run tests - they should fail**

```bash
npm test -- --grep "DATA_ACCESS_BACKEND"
```

**Step 3: Modify src/service/index.js**

Wrap existing logic in a `createDynamoDataAccess()` function. Add feature flag routing:

```js
// Add at top of file:
import { createPostgresDataAccess } from './postgres/index.js';

// Rename existing createDataAccess internals to createDynamoDataAccess
const createDynamoDataAccess = (config, log, client) => {
  // ... existing ElectroDB/DynamoDB initialization code (unchanged)
};

// New entry point with feature flag
export const createDataAccess = (config, log = console, client = undefined) => {
  const backend = process.env.DATA_ACCESS_BACKEND || 'dynamodb';

  if (backend === 'postgresql') {
    return createPostgresDataAccess(config, log);
  } else if (backend === 'dynamodb') {
    return createDynamoDataAccess(config, log, client);
  } else {
    throw new Error(
      `Invalid DATA_ACCESS_BACKEND: "${backend}". Must be "dynamodb" or "postgresql".`,
    );
  }
};
```

**Step 4: Modify src/index.js (wrapper)**

Add PostgreSQL env vars to the wrapper:

```js
// In the wrapper function, add to env destructuring:
const {
  DYNAMO_TABLE_NAME_DATA: tableNameData = DEFAULT_TABLE_NAME,
  POSTGREST_URL: postgrestUrl,
  POSTGREST_SCHEMA: postgrestSchema,
  POSTGREST_API_KEY: postgrestApiKey,
  S3_CONFIG_BUCKET: s3Bucket,
  AWS_REGION: region,
} = context.env;

// Pass all config to createDataAccess (it picks what it needs based on backend)
context.dataAccess = createDataAccess({
  tableNameData, postgrestUrl, postgrestSchema, postgrestApiKey, s3Bucket, region,
}, log);
```

**Step 5: Create stub for postgres service**

Create `src/service/postgres/index.js`:

```js
export const createPostgresDataAccess = (config, log) => {
  // Stub - will be implemented in Task 7
  throw new Error('PostgreSQL backend not yet implemented');
};
```

**Step 6: Run tests**

```bash
npm test
```
Expected: All pass (default backend is dynamodb, unchanged behavior)

**Step 7: Commit**

```bash
git add src/service/index.js src/index.js src/service/postgres/index.js test/unit/service/index.test.js
git commit -m "feat(data-access): add DATA_ACCESS_BACKEND feature flag"
```

---

## Task 4: PostgresBaseCollection

The core class that maps the BaseCollection public API to PostgREST queries. Port and adapt from ED's modified `base.collection.js` on `v3-postgrest-data-access`.

**Files:**
- Create: `src/models/postgres/base/postgres-base.collection.js`
- Create: `test/unit/models/postgres/base/postgres-base.collection.test.js`

**Step 1: Write tests**

Test with a mocked postgrest-js client. Key behaviors to test:
- `findById(id)` - calls `.from(table).select('*').eq('id', id).single()`, transforms response
- `all()` - calls `.from(table).select('*')`, returns array of model instances
- `allByIndexKeys(keys)` - applies key filters, returns array
- `create(item)` - transforms to snake_case, calls `.insert()`, returns model instance
- `createMany(items)` - batch insert, returns `{createdItems, errorItems}`
- `removeByIds(ids)` - calls `.delete().in('id', ids)`
- Field mapping: camelCase input -> snake_case query -> camelCase output
- Pagination: respects limit, order, cursor options
- Auto-generated index accessors: `allByOrganizationId()`, `findByOrganizationId()`, etc.

Mock the postgrest-js client using sinon stubs that return chainable objects (`.from().select().eq().single()` pattern).

**Step 2: Run tests - they fail**

**Step 3: Implement PostgresBaseCollection**

Reference ED's `base.collection.js` on the v3 branch. Key adaptations:
- Constructor takes `(postgrestClient, entityRegistry, schema, log)` - identical signature to BaseCollection but uses PostgREST client instead of ElectroDB service
- Store `this.tableName` from `entityToTableName(schema.getModelName())`
- Store `this.fieldMaps` from `createFieldMaps(schema)`
- `#initializeCollectionMethods()` - generate `allByX()` / `findByX()` methods from `schema.toAccessorConfigs()`
- All query methods use `this.postgrestClient.from(this.tableName)`
- All record transforms use `toDbRecord()` / `fromDbRecord()` with field maps
- `#createInstance(record)` - creates model via `new schema.getModelClass()(postgrestClient, entityRegistry, schema, record, log)`

Key methods to implement (reference ED's code for PostgREST query patterns):

| Method | PostgREST Implementation |
|--------|------------------------|
| `findById(id)` | `.from(table).select(select).eq('id', id).single()` then `fromDbRecord()` |
| `all(sortKeys, options)` | `.from(table).select(select)` + order + limit + pagination |
| `allByIndexKeys(keys, options)` | `.from(table).select(select)` + `.eq()` per key + order + pagination |
| `findByIndexKeys(keys, options)` | Same as allByIndexKeys with `limit(1)` |
| `existsById(id)` | `.from(table).select('id').eq('id', id)` check data length |
| `batchGetByKeys(keys)` | `.from(table).select(select).in('id', ids)` |
| `create(item)` | `#prepareItem()` then `.from(table).insert(toDbRecord(item)).select().single()` |
| `createMany(items)` | Batch `.insert()` with error tracking per item |
| `updateByKeys(keys, updates)` | `.from(table).update(toDbRecord(updates)).eq(keys).select()` |
| `removeByIds(ids)` | `.from(table).delete().in('id', ids)` |
| `removeByIndexKeys(keys)` | `.from(table).delete()` + `.eq()` per key |
| `applyUpdateWatchers(record, updates)` | Process schema attribute watchers |

Also implement:
- `#prepareItem(item)` - applies defaults, setters, validates (port from existing BaseCollection)
- `#applyDefaults(record)` - applies schema default values
- `#applySetters(record)` - applies schema setter functions
- `#validateItem(item)` - validates against schema constraints
- `_onCreate(item)` / `_onCreateMany({createdItems, errorItems})` - hooks (no-op by default)
- `_saveMany(items)` - batch update

**Step 4: Run tests - they pass**

**Step 5: Commit**

```bash
git add src/models/postgres/base/postgres-base.collection.js test/unit/models/postgres/base/postgres-base.collection.test.js
git commit -m "feat(data-access): add PostgresBaseCollection with PostgREST query layer"
```

---

## Task 5: PostgresBaseModel and PostgresPatcher

**Files:**
- Create: `src/models/postgres/base/postgres-base.model.js`
- Create: `src/util/postgres-patcher.js`
- Create: `test/unit/models/postgres/base/postgres-base.model.test.js`
- Create: `test/unit/util/postgres-patcher.test.js`

**Step 1: Write Patcher tests**

```js
describe('PostgresPatcher', () => {
  it('tracks changes via patchValue', () => { /* ... */ });
  it('validates read-only attributes', () => { /* ... */ });
  it('validates updates allowed', () => { /* ... */ });
  it('save() calls collection.updateByKeys with snake_case updates', () => { /* ... */ });
  it('hasUpdates() returns false when clean', () => { /* ... */ });
  it('updates updatedAt on save', () => { /* ... */ });
});
```

**Step 2: Write Model tests**

```js
describe('PostgresBaseModel', () => {
  it('auto-generates getters from schema attributes', () => { /* ... */ });
  it('auto-generates setters that track via patcher', () => { /* ... */ });
  it('getId() returns the id from record', () => { /* ... */ });
  it('save() delegates to patcher.save()', () => { /* ... */ });
  it('remove() cascades dependents then deletes self', () => { /* ... */ });
  it('toJSON() returns camelCase plain object', () => { /* ... */ });
  it('relationship accessors are cached', () => { /* ... */ });
  it('belongs_to accessor fetches parent by FK', () => { /* ... */ });
  it('has_many accessor fetches children by FK', () => { /* ... */ });
});
```

**Step 3: Implement PostgresPatcher**

Port from ED's `patcher.js`. Key difference from v2 Patcher: no ElectroDB `patchRecord` - instead uses `collection.updateByKeys(compositeKeys, updates)` exclusively.

- Constructor: `(collection, schema, record)` - same as v2
- `patchValue(propertyName, value, isReference)` - same validation, same type guards
- `save()` - calls `collection.applyUpdateWatchers()` then `collection.updateByKeys(keys, updates)`
- `getUpdates()`, `hasUpdates()` - same as v2

**Step 4: Implement PostgresBaseModel**

Port from ED's `base.model.js`. Structure:
- Constructor: `(postgrestClient, entityRegistry, schema, record, log)` - same as v2 BaseModel
- `#initializeReferences()` - creates belongs_to/has_many/has_one accessor methods (same logic as v2)
- `#initializeAttributes()` - creates getXxx/setXxx methods from schema (same logic as v2)
- `getId()`, `getCreatedAt()`, `getUpdatedAt()`, `getRecordExpiresAt()` - same
- `save()` - delegates to `this.patcher.save()`, invalidates cache
- `remove()` - checks `schema.allowsRemove()`, cascades dependents, then deletes
- `toJSON()` - returns plain object from schema attributes
- `_remove()` - internal remove without allowRemove check (for cascade)

The model class is largely identical to v2 BaseModel. The only difference is using PostgresPatcher instead of Patcher.

**Step 5: Run tests - they pass**

**Step 6: Commit**

```bash
git add src/models/postgres/base/postgres-base.model.js src/util/postgres-patcher.js \
  test/unit/models/postgres/base/postgres-base.model.test.js test/unit/util/postgres-patcher.test.js
git commit -m "feat(data-access): add PostgresBaseModel and PostgresPatcher"
```

---

## Task 6: PostgresEntityRegistry and Wiring

Wire up the PostgreSQL code path so `createPostgresDataAccess()` returns real collections.

**Files:**
- Create: `src/service/postgres/postgres-entity-registry.js`
- Modify: `src/service/postgres/index.js` (replace stub)
- Create: `test/unit/service/postgres/postgres-entity-registry.test.js`

**Step 1: Write tests**

```js
describe('PostgresEntityRegistry', () => {
  it('initializes all collections', () => {
    const registry = new PostgresEntityRegistry(mockClient, mockConfig, log);
    const collections = registry.getCollections();
    expect(Object.keys(collections)).to.include.members([
      'site', 'organization', 'audit', 'opportunity', 'configuration',
    ]);
  });

  it('getCollection returns the correct collection', () => {
    const registry = new PostgresEntityRegistry(mockClient, mockConfig, log);
    expect(registry.getCollection('site')).to.be.instanceOf(PostgresSiteCollection);
  });

  it('getCollection throws for unknown name', () => {
    const registry = new PostgresEntityRegistry(mockClient, mockConfig, log);
    expect(() => registry.getCollection('nonexistent')).to.throw();
  });
});
```

**Step 2: Implement PostgresEntityRegistry**

```js
// src/service/postgres/postgres-entity-registry.js
import { PostgresBaseCollection } from '../../models/postgres/base/postgres-base.collection.js';
import { ConfigurationCollection } from '../../models/configuration/configuration.collection.js';
// Import all entity-specific Postgres collections (Task 8-9)

class PostgresEntityRegistry {
  #collections = {};
  #client;
  #log;

  constructor(client, config, log) {
    this.#client = client;
    this.#log = log;
    this.s3Config = config.s3 || null;
    this.#initialize();
  }

  #initialize() {
    // Register all Postgres collections
    // Uses same schema objects from existing entity schemas
    // but wraps them with PostgresBaseCollection
    PostgresEntityRegistry.entities.forEach(({ collection: Collection, schema }) => {
      const instance = new Collection(this.#client, this, schema, this.#log);
      this.#collections[schema.getCollectionName()] = instance;
    });

    // Configuration: stays S3-based for now (or Postgres if table exists)
    if (this.s3Config) {
      this.#collections.configuration = new ConfigurationCollection(this.s3Config, this.#log);
    }
  }

  getCollection(name) {
    const collection = this.#collections[name];
    if (!collection) {
      throw new Error(`Collection not found: ${name}`);
    }
    return collection;
  }

  getCollections() {
    return { ...this.#collections };
  }
}
```

**Step 3: Wire up createPostgresDataAccess**

Replace the stub in `src/service/postgres/index.js`:

```js
import { PostgrestClient } from '@supabase/postgrest-js';
import { PostgresEntityRegistry } from './postgres-entity-registry.js';

export const createPostgresDataAccess = (config, log) => {
  const {
    postgrestUrl,
    postgrestSchema = 'public',
    postgrestApiKey,
    postgrestHeaders = {},
    s3Bucket,
    region,
  } = config;

  if (!postgrestUrl) {
    throw new Error('postgrestUrl is required for PostgreSQL backend');
  }

  const headers = {
    ...postgrestHeaders,
    ...(postgrestApiKey
      ? { apikey: postgrestApiKey, Authorization: `Bearer ${postgrestApiKey}` }
      : {}),
  };

  const client = new PostgrestClient(postgrestUrl, { schema: postgrestSchema, headers });

  const s3Config = s3Bucket ? createS3Service({ s3Bucket, region }) : null;

  const registry = new PostgresEntityRegistry(client, { s3: s3Config }, log);
  return registry.getCollections();
};
```

**Step 4: Run tests**

```bash
npm test
```

**Step 5: Commit**

```bash
git add src/service/postgres/ test/unit/service/postgres/
git commit -m "feat(data-access): add PostgresEntityRegistry and wire up createPostgresDataAccess"
```

---

## Task 7: Entity Postgres Collections - Simple Entities (batch)

Most entities are trivial - they just extend PostgresBaseCollection with no custom methods. The schema is reused from the existing v2 schema files (SchemaBuilder schemas are storage-agnostic in terms of attributes and references).

**Key insight:** The existing Schema objects already contain all the attribute definitions, references, and indexes needed. PostgresBaseCollection reads these to auto-generate accessor methods and field maps. For simple entities, the Postgres collection class is just:

```js
class PostgresSiteCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'site';
}
```

And the model class is:

```js
class PostgresSiteModel extends PostgresBaseModel {
  static ENTITY_NAME = 'Site';
}
```

The schema from `site.schema.js` is reused as-is. The `postgrestField` attribute property (if set) overrides the default camelToSnake mapping. For most attributes, the convention-based mapping works.

**Files to create (one pair per entity):**

For each entity, create `src/models/postgres/{entity}/` with:
- `{entity}.pg.collection.js` - extends PostgresBaseCollection, static COLLECTION_NAME
- `{entity}.pg.model.js` - extends PostgresBaseModel, static ENTITY_NAME

**Simple entities (no custom methods beyond base):**

| Entity | Collection Name | Model Entity Name |
|--------|----------------|-------------------|
| ApiKey | apiKey | ApiKey |
| AsyncJob | asyncJob | AsyncJob |
| AuditUrl | auditUrl | AuditUrl |
| Consumer | consumer | Consumer |
| Entitlement | entitlement | Entitlement |
| Experiment | experiment | Experiment |
| FixEntity | fixEntity | FixEntity |
| FixEntitySuggestion | fixEntitySuggestion | FixEntitySuggestion |
| ImportJob | importJob | ImportJob |
| ImportUrl | importUrl | ImportUrl |
| Opportunity | opportunity | Opportunity |
| PageCitability | pageCitability | PageCitability |
| PageIntent | pageIntent | PageIntent |
| Project | project | Project |
| Report | report | Report |
| ScrapeJob | scrapeJob | ScrapeJob |
| ScrapeUrl | scrapeUrl | ScrapeUrl |
| SentimentGuideline | sentimentGuideline | SentimentGuideline |
| SentimentTopic | sentimentTopic | SentimentTopic |
| SiteCandidate | siteCandidate | SiteCandidate |
| SiteEnrollment | siteEnrollment | SiteEnrollment |
| SiteTopForm | siteTopForm | SiteTopForm |
| SiteTopPage | siteTopPage | SiteTopPage |
| Suggestion | suggestion | Suggestion |
| TrialUser | trialUser | TrialUser |
| TrialUserActivity | trialUserActivity | TrialUserActivity |

**Step 1: Create a generator script or manually create all 26 simple entity pairs**

Each file follows the exact same pattern. Example for ApiKey:

```js
// src/models/postgres/api-key/api-key.pg.collection.js
import { PostgresBaseCollection } from '../base/postgres-base.collection.js';

export class PostgresApiKeyCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'apiKey';
}

// src/models/postgres/api-key/api-key.pg.model.js
import { PostgresBaseModel } from '../base/postgres-base.model.js';

export class PostgresApiKeyModel extends PostgresBaseModel {
  static ENTITY_NAME = 'ApiKey';
}
```

**Step 2: Copy custom model methods from v2 models**

Some "simple" entities have custom methods on the model class that must be preserved:
- `ApiKey.isValid()` - date checks (no DB calls, pure logic)
- `Experiment` - static DEFAULT_UPDATED_BY
- `Organization` - static IMS_ORG_ID_REGEX
- `Audit` - static AUDIT_TYPES, AUDIT_TYPE_PROPERTIES, validateAuditResult, getScores

Copy these domain methods to the Postgres model classes. They are storage-agnostic.

**Step 3: Register all entities in PostgresEntityRegistry**

Update `postgres-entity-registry.js` to import and register all 26 entity collection/schema pairs.

**Step 4: Run unit tests**

```bash
npm test
```

**Step 5: Commit**

```bash
git add src/models/postgres/
git commit -m "feat(data-access): add Postgres collections for all simple entities"
```

---

## Task 8: Entity Postgres Collections - Complex Entities

These entities have custom collection methods that need PostgREST-specific implementations.

### 8a: Organization (simple collection, complex model)

**Files:**
- Create: `src/models/postgres/organization/organization.pg.collection.js`
- Create: `src/models/postgres/organization/organization.pg.model.js`

Organization collection has no custom methods. Model has `IMS_ORG_ID_REGEX` static.

### 8b: Site (most complex entity)

**Files:**
- Create: `src/models/postgres/site/site.pg.collection.js`
- Create: `src/models/postgres/site/site.pg.model.js`
- Create: `test/unit/models/postgres/site/site.pg.collection.test.js`

Custom collection methods to implement:
- `allSitesToAudit()` - query sites, return IDs with projection
- `allWithLatestAudit(auditType, order, deliveryType)` - join sites with latest audit, cache relationship
- `findByPreviewURL(previewURL)` - parse Helix/AEM-CS URL, delegate to findByExternalOwnerIdAndExternalSiteId

Custom model methods:
- `computeExternalIds()` - compute owner/site IDs from config
- `getAuthoringType()` - parse hostname
- `toggleLive()` - toggle isLive flag
- `resolveFinalURL()` - get final URL with overrides

Reference ED's `site.collection.js` on v3 branch for PostgREST implementations of these methods.

### 8c: Audit (immutable, lifecycle hooks)

**Files:**
- Create: `src/models/postgres/audit/audit.pg.collection.js`
- Create: `src/models/postgres/audit/audit.pg.model.js`

Key behaviors:
- Schema has `allowUpdates(false)` and `allowRemove(false)` - immutable
- `_onCreate(item)` - creates LatestAudit record (v2 behavior)
- `_onCreateMany({createdItems})` - creates LatestAudit for latest per site+type

**Important v3 decision (from ED's branch):** LatestAudit is computed from Audit queries, so `_onCreate`/`_onCreateMany` become no-ops. Follow ED's approach.

### 8d: LatestAudit (computed/virtual entity)

**Files:**
- Create: `src/models/postgres/latest-audit/latest-audit.pg.collection.js`
- Create: `src/models/postgres/latest-audit/latest-audit.pg.model.js`

Reference ED's `latest-audit.collection.js` on v3 branch:
- `create()` / `createMany()` throw: "LatestAudit is derived from Audit in v3 and cannot be created directly"
- `findById(siteId, auditType)` - queries Audit table for newest by auditedAt
- `allByIndexKeys(keys)` - queries Audit, groups by field set, returns one per group
- `#groupLatest()` - groups audits by specified fields, keeps newest

### 8e: KeyEvent (deprecated)

**Files:**
- Create: `src/models/postgres/key-event/key-event.pg.collection.js`
- Create: `src/models/postgres/key-event/key-event.pg.model.js`

Reference ED's `key-event.collection.js` on v3 branch:
- All methods throw: "KeyEvent is deprecated in data-access v3"

### 8f: Configuration (S3-based, shared with DynamoDB path)

For the PostgreSQL path, Configuration continues to use S3 (same `ConfigurationCollection` class). This is already handled in Task 6 (PostgresEntityRegistry delegates to existing ConfigurationCollection with S3 service).

No new files needed. The Configuration entity is backend-agnostic (it's always S3).

**Note:** The design doc says "migrate to Postgres" but this requires a `configurations` table in mysticat-data-service that doesn't exist yet. Defer to a follow-up task. For now, S3 for both backends.

**Step: Run tests after all complex entities**

```bash
npm test
```

**Step: Commit**

```bash
git add src/models/postgres/ test/unit/models/postgres/
git commit -m "feat(data-access): add Postgres collections for complex entities (Site, Audit, LatestAudit, KeyEvent)"
```

---

## Task 9: Schema Attribute PostgREST Field Annotations

Some entity attributes don't follow the simple camelToSnake convention. These need explicit `postgrestField` annotations in the existing schema files so `createFieldMaps()` generates correct mappings.

**Files:**
- Modify: Various `src/models/*/entity.schema.js` files

**Step 1: Audit all entities for non-trivial field mappings**

Compare each schema's attribute names against the Postgres column names in mysticat-data-service. Look for:
- `organizationId` -> `org_id` (not `organization_id`)
- `siteId` -> `site_id` (convention works)
- `baseURL` -> `base_url` (convention works, `camelToSnake('baseURL')` = `base_url`)
- Entity ID fields: `siteId` primary key -> `id` in Postgres (handled by `createFieldMaps`)

Check mysticat-data-service's migration files or PostgREST API docs to confirm column names.

**Step 2: Add `postgrestField` to attributes that need explicit mapping**

In each schema file, add `postgrestField` property to attributes where the default `camelToSnake()` mapping is wrong:

```js
// Example: if organizationId maps to 'org_id' not 'organization_id'
.addAttribute('organizationId', {
  type: 'string',
  postgrestField: 'org_id',  // explicit override
})
```

**Step 3: Write a test that validates all field mappings**

Create a test that for each entity, compares the generated field map against a known-correct mapping.

**Step 4: Run tests**

```bash
npm test
```

**Step 5: Commit**

```bash
git add src/models/
git commit -m "feat(data-access): add postgrestField annotations for non-trivial column mappings"
```

---

## Task 10: Integration Test Infrastructure

Set up Docker Compose and backend-agnostic test fixtures so the existing IT tests can run against both DynamoDB and PostgreSQL.

**Files:**
- Modify: `test/it/fixtures.js` (conditional backend setup)
- Modify: `test/it/util/db.js` (conditional getDataAccess)
- Create: `test/it/util/seed-postgres.js` (seed via PostgREST)
- Modify: `test/it/util/seed.js` (delegate based on backend)
- Create: `test/it/util/docker-compose.yml` (PostgreSQL + PostgREST)
- Modify: `package.json` (add test:it:postgres script)

**Step 1: Create Docker Compose file**

Reference ED's `test/it/postgrest/docker-compose.yml`:

```yaml
# test/it/util/docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mysticat
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "${IT_POSTGRES_PORT:-55432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 2s
      timeout: 5s
      retries: 10

  data-service:
    image: ${DATA_SERVICE_IMAGE:-ghcr.io/adobe/mysticat-data-service}:${DATA_SERVICE_TAG:-v1.7.1}
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://postgrest_authenticator:postgres@postgres:5432/mysticat
      PGRST_DB_ANON_ROLE: postgrest_anon
    ports:
      - "${IT_POSTGREST_PORT:-3300}:3000"
```

**Step 2: Modify fixtures.js for conditional backend**

```js
// test/it/fixtures.js
const backend = process.env.DATA_ACCESS_BACKEND || 'dynamodb';

export async function mochaGlobalSetup() {
  if (backend === 'postgresql') {
    // Start Docker Compose
    execSync('docker compose -f test/it/util/docker-compose.yml up -d --wait', { stdio: 'inherit' });
  } else {
    // Start DynamoDB Local (existing code)
    // ... existing DynamoDB Local spawn ...
  }
}

export async function mochaGlobalTeardown() {
  if (backend === 'postgresql') {
    execSync('docker compose -f test/it/util/docker-compose.yml down -v', { stdio: 'inherit' });
  } else {
    // Stop DynamoDB Local (existing code)
  }
}
```

**Step 3: Modify db.js for conditional getDataAccess**

```js
// test/it/util/db.js
export function getDataAccess() {
  const backend = process.env.DATA_ACCESS_BACKEND || 'dynamodb';

  if (backend === 'postgresql') {
    return createDataAccess({
      postgrestUrl: process.env.POSTGREST_URL || 'http://127.0.0.1:3300',
    }, createLogger());
  }

  // Existing DynamoDB path
  return createDataAccess({
    tableNameData: 'spacecat-services-data',
    // ... existing DynamoDB config
  }, createLogger(), dynamoClient);
}
```

**Step 4: Create seed-postgres.js**

Seeds test data via PostgREST HTTP calls instead of DynamoDB bulk writes:

```js
// test/it/util/seed-postgres.js
import { PostgrestClient } from '@supabase/postgrest-js';

const client = new PostgrestClient(process.env.POSTGREST_URL || 'http://127.0.0.1:3300');

export async function seedDatabase() {
  // Clear existing data (reverse dependency order)
  await client.from('suggestions').delete().neq('id', '');
  await client.from('opportunities').delete().neq('id', '');
  await client.from('audits').delete().neq('id', '');
  await client.from('sites').delete().neq('id', '');
  await client.from('organizations').delete().neq('id', '');
  // ... all tables

  // Seed in dependency order
  const orgs = await client.from('organizations').insert([
    { id: 'test-org-id-1', name: 'Test Org', ims_org_id: 'test@AdobeOrg', config: {} },
  ]).select();

  const sites = await client.from('sites').insert([
    { id: 'test-site-id-1', base_url: 'https://example.com', org_id: 'test-org-id-1', delivery_type: 'aem_edge', config: {}, is_live: false },
  ]).select();

  // ... seed all test data matching existing DynamoDB fixtures

  // Return sampleData in same shape as existing seedDatabase()
  return { organizations: orgs.data, sites: sites.data, /* ... */ };
}
```

**Important:** The seeded data must match the existing DynamoDB test fixtures exactly (same IDs, same field values) so that test assertions pass without changes.

**Step 5: Modify seed.js to delegate**

```js
// test/it/util/seed.js
import { seedDatabase as seedDynamo } from './seed-dynamo.js';  // renamed from existing
import { seedDatabase as seedPostgres } from './seed-postgres.js';

export async function seedDatabase() {
  const backend = process.env.DATA_ACCESS_BACKEND || 'dynamodb';
  return backend === 'postgresql' ? seedPostgres() : seedDynamo();
}
```

**Step 6: Add npm script**

In `package.json`:
```json
{
  "scripts": {
    "test:it": "mocha test/it/**/*.test.js",
    "test:it:postgres": "DATA_ACCESS_BACKEND=postgresql POSTGREST_URL=http://127.0.0.1:3300 npm run test:it"
  }
}
```

**Step 7: Run IT tests against DynamoDB (should still pass)**

```bash
npm run test:it
```

**Step 8: Commit**

```bash
git add test/it/ package.json
git commit -m "feat(data-access): add backend-agnostic IT test infrastructure with Docker Compose"
```

---

## Task 11: Run Full IT Suite Against PostgreSQL

**Step 1: Start Docker Compose**

```bash
cd packages/spacecat-shared-data-access
docker compose -f test/it/util/docker-compose.yml up -d --wait
```

**Step 2: Verify PostgREST is responding**

```bash
curl -s http://127.0.0.1:3300/ | head -5
```
Expected: PostgREST OpenAPI JSON response

**Step 3: Run IT tests against PostgreSQL**

```bash
npm run test:it:postgres
```

**Step 4: Fix failures**

This is where the rubber meets the road. Common failure causes:
- Field mapping mismatches (fix in pg.schema or add `postgrestField` annotations)
- Query ordering differences (DynamoDB composite sort keys vs PostgreSQL ORDER BY)
- UUID format differences (v4 vs v7, string vs UUID type)
- Null handling (DynamoDB omits missing attributes, PostgreSQL returns null)
- Date format differences (ISO strings vs PostgreSQL timestamps)
- Pagination behavior differences (ElectroDB cursor vs offset-based)
- Seed data issues (missing data in Postgres, wrong format)

For each failure:
1. Identify root cause
2. Fix in the Postgres adapter code (NOT in the test)
3. Verify the fix doesn't break DynamoDB tests

**Step 5: Verify DynamoDB tests still pass**

```bash
npm run test:it
```

**Step 6: Run both backends one final time**

```bash
npm run test:it && npm run test:it:postgres
```
Expected: ALL PASS on both

**Step 7: Stop Docker Compose**

```bash
docker compose -f test/it/util/docker-compose.yml down -v
```

**Step 8: Final commit**

```bash
git add -A
git commit -m "feat(data-access): all IT tests passing on both DynamoDB and PostgreSQL backends"
```

---

## Task 12: Documentation and Cleanup

**Files:**
- Modify: `README.md` - document feature flag, PostgreSQL setup, environment variables
- Modify: `CHANGELOG.md` - document the new feature

**Step 1: Update README**

Add section on:
- `DATA_ACCESS_BACKEND` environment variable
- PostgreSQL backend configuration (`POSTGREST_URL`, `POSTGREST_API_KEY`)
- How to run IT tests against PostgreSQL
- Migration notes

**Step 2: Review all new files for TODO/FIXME**

```bash
grep -r 'TODO\|FIXME\|HACK' src/models/postgres/ src/service/postgres/ src/util/postgres*.js
```

**Step 3: Final test run**

```bash
npm test && npm run test:it
```

**Step 4: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs(data-access): document PostgreSQL backend and feature flag"
```

---

## Summary: File Count Estimate

| Category | Files | Notes |
|----------|-------|-------|
| Utilities | 2 | postgrest.utils.js, postgres-patcher.js |
| Base classes | 2 | PostgresBaseCollection, PostgresBaseModel |
| Service | 2 | postgres/index.js, postgres-entity-registry.js |
| Simple entities (26) | 52 | 2 files each (collection + model) |
| Complex entities (5) | 10 | 2 files each (Site, Audit, LatestAudit, KeyEvent, Organization) |
| Modified existing | 4 | service/index.js, index.js, various schemas |
| Tests (unit) | ~8 | Base classes, patcher, utils, registry |
| Tests (IT infra) | 3 | docker-compose.yml, seed-postgres.js, fixtures |
| **Total new files** | **~79** | |
| **Total modified** | **~10** | |

## Dependency Order

```
Task 1 (deps)
  -> Task 2 (utils)
    -> Task 3 (feature flag)
      -> Task 4 (PostgresBaseCollection)
        -> Task 5 (PostgresBaseModel + Patcher)
          -> Task 6 (Registry + wiring)
            -> Task 7 (simple entities) + Task 8 (complex entities)  [parallel]
              -> Task 9 (schema annotations)
                -> Task 10 (IT infrastructure)
                  -> Task 11 (run IT suite + fix)
                    -> Task 12 (docs)
```

Tasks 7 and 8 can be parallelized (independent entity implementations).
