# Spacecat Shared Data Access (v3)

`@adobe/spacecat-shared-data-access` is the shared data-access layer used by Spacecat services.

This package is **v3 Postgres-first**:
- Primary datastore: **Postgres via PostgREST** (`@supabase/postgrest-js`)
- Optional secondary datastore: **S3** (for `Configuration`)
- No ElectroDB/DynamoDB runtime dependency in v3 behavior

## Installation

```bash
npm install @adobe/spacecat-shared-data-access
```

## What You Get

The package provides:
- `createDataAccess(config, log?, client?)`
- `dataAccessWrapper(fn)` (default export) for Helix/Lambda style handlers
- Entity collections/models with stable external API shape for services

## Quick Start

```js
import { createDataAccess } from '@adobe/spacecat-shared-data-access';

const dataAccess = createDataAccess({
  postgrestUrl: process.env.POSTGREST_URL,
  postgrestSchema: process.env.POSTGREST_SCHEMA || 'public',
  postgrestApiKey: process.env.POSTGREST_API_KEY,
  // Only needed if you use Configuration entity:
  s3Bucket: process.env.S3_CONFIG_BUCKET,
  region: process.env.AWS_REGION,
}, console);

const site = await dataAccess.Site.findById('0983c6da-0dee-45cc-b897-3f1fed6b460b');
console.log(site?.getBaseURL());
```

## Configuration

### `createDataAccess` config

- `postgrestUrl` (required): Base URL of PostgREST server
- `postgrestSchema` (optional): Postgres schema exposed by PostgREST, default `public`
- `postgrestApiKey` (optional): Added as `apikey` and `Authorization: Bearer ...`
- `postgrestHeaders` (optional): Extra headers for PostgREST client
- `s3Bucket` (optional): Required only for `Configuration` entity
- `region` (optional): AWS region for S3 client

### Custom PostgREST client

You can inject an already-constructed PostgREST client as third argument:

```js
import { PostgrestClient } from '@supabase/postgrest-js';
import { createDataAccess } from '@adobe/spacecat-shared-data-access';

const client = new PostgrestClient(process.env.POSTGREST_URL, { schema: 'public' });
const dataAccess = createDataAccess({ postgrestUrl: process.env.POSTGREST_URL }, console, client);
```

## Wrapper Usage

Default export is a wrapper that attaches `context.dataAccess`.

```js
import wrap from '@adobe/helix-shared-wrap';
import dataAccessWrapper from '@adobe/spacecat-shared-data-access';

async function run(request, context) {
  const { dataAccess } = context;
  const site = await dataAccess.Site.findById(request.params.siteId);
  return {
    statusCode: site ? 200 : 404,
    body: site ? site.toJSON() : { error: 'not found' },
  };
}

export const main = wrap(run)
  .with(dataAccessWrapper);
```

The wrapper reads from `context.env`:
- `POSTGREST_URL` (default fallback: `http://localhost:3000`)
- `POSTGREST_SCHEMA`
- `POSTGREST_API_KEY`
- `S3_CONFIG_BUCKET`
- `AWS_REGION`

## Field Mapping Behavior

Public model API remains camelCase while Postgres/PostgREST tables are snake_case.

Examples:
- `site.siteId` <-> `sites.id`
- `site.baseURL` <-> `sites.base_url`

The mapping is handled in the base PostgREST utilities and applied on both read and write paths.

## Entities

Current exported entities include:
- `ApiKey`
- `AsyncJob`
- `Audit`
- `AuditUrl`
- `Configuration`
- `Entitlement`
- `Experiment`
- `FixEntity`
- `FixEntitySuggestion`
- `ImportJob`
- `ImportUrl`
- `KeyEvent`
- `LatestAudit`
- `Opportunity`
- `Organization`
- `PageCitability`
- `PageIntent`
- `Project`
- `Report`
- `ScrapeJob`
- `ScrapeUrl`
- `SentimentGuideline`
- `SentimentTopic`
- `Site`
- `SiteCandidate`
- `SiteEnrollment`
- `SiteTopForm`
- `SiteTopPage`
- `Suggestion`
- `TrialUser`
- `TrialUserActivity`

## Architecture

```
Lambda / ECS service
  -> @adobe/spacecat-shared-data-access (this package)
       -> @supabase/postgrest-js
            -> mysticat-data-service (PostgREST + Aurora PostgreSQL)
                 https://github.com/adobe/mysticat-data-service
```

**v2 (retired):** ElectroDB -> DynamoDB (direct, schema-in-code)
**v3 (current):** PostgREST client -> [mysticat-data-service](https://github.com/adobe/mysticat-data-service) (schema-in-database)

The database schema (tables, indexes, enums, grants) lives in **mysticat-data-service** as dbmate migrations.
This package provides the JavaScript model/collection layer that maps camelCase entities to the snake_case PostgREST API.

## V3 Behavior Notes

- `Configuration` remains S3-backed in v3.
- `KeyEvent` is deprecated in v3 and intentionally throws on access/mutation methods.
- `LatestAudit` is virtual in v3 and derived from `Audit` queries (no dedicated table required).

## Changing Entities

Adding or modifying an entity now requires changes in **two repositories**:

### 1. Database schema — [mysticat-data-service](https://github.com/adobe/mysticat-data-service)

Create a dbmate migration for the schema change (table, columns, indexes, grants, enums):

```bash
# In mysticat-data-service
make migrate-new name=add_foo_column_to_sites
# Edit db/migrations/YYYYMMDDHHMMSS_add_foo_column_to_sites.sql
make migrate
docker compose -f docker/docker-compose.yml restart postgrest
make test
```

See the [mysticat-data-service CLAUDE.md](https://github.com/adobe/mysticat-data-service/blob/main/CLAUDE.md) for migration conventions (required grants, indexes, comments, etc.).

### 2. Model/collection layer — this package

Update the entity schema, model, and/or collection in `src/models/<entity>/`:

| File | What to change |
|------|---------------|
| `<entity>.schema.js` | Add/modify attributes, references, indexes |
| `<entity>.model.js` | Add business logic methods |
| `<entity>.collection.js` | Add custom query methods |

**Adding a new attribute example:**

```js
// In <entity>.schema.js, add to the SchemaBuilder chain:
.addAttribute('myNewField', {
  type: 'string',
  required: false,
  // Optional: custom DB column name (default: camelToSnake)
  // postgrestField: 'custom_column_name',
})
```

This automatically generates `getMyNewField()` and `setMyNewField()` on the model.

**Adding a new entity:** Create 4 files following the pattern in any existing entity folder:
- `<entity>.schema.js` — SchemaBuilder definition
- `<entity>.model.js` — extends `BaseModel`
- `<entity>.collection.js` — extends `BaseCollection`
- `index.js` — re-exports model, collection, schema

Then register the entity in `src/models/index.js`.

### 3. Integration test the full stack

```bash
# In this package — runs PostgREST in Docker
npm run test:it
```

Integration tests pull the `mysticat-data-service` Docker image from ECR, so new schema changes must be published as a new image tag first (or test against a local PostgREST).

## Migrating from V2

If you are upgrading from DynamoDB/ElectroDB-based v2:

### What stays the same

- You still use `createDataAccess(...)`.
- You still access collections through `dataAccess.<Entity>` (for example `dataAccess.Site`).
- Model/collection APIs are intended to stay stable for service callers.

### What changes

- Backing store is now Postgres via PostgREST, not DynamoDB/ElectroDB.
- You must provide `postgrestUrl` (or `POSTGREST_URL` via wrapper env).
- Schema changes now go through [mysticat-data-service](https://github.com/adobe/mysticat-data-service) migrations, not code.
- `Configuration` remains S3-backed (requires `s3Bucket`/`S3_CONFIG_BUCKET` when used).
- `KeyEvent` is deprecated in v3 and now throws.
- `LatestAudit` is no longer a dedicated table and is computed from `Audit` queries.

### Required environment/config updates

- Replace old Dynamo-specific configuration with:
  - `POSTGREST_URL`
  - optional `POSTGREST_SCHEMA`
  - optional `POSTGREST_API_KEY`
- Keep S3 config envs only if using `Configuration`:
  - `S3_CONFIG_BUCKET`
  - `AWS_REGION`

## Development

## Local Development

### First-time setup

From the monorepo root:

```bash
npm install
```

Optional: verify package tooling from this workspace:

```bash
cd packages/spacecat-shared-data-access
node -v
npm -v
```

### Day-to-day workflow

1. Create/switch to a feature branch.
2. Make code changes in `src/` and tests in `test/unit` and `test/it`.
3. Run unit tests while iterating.
4. Run integration tests before opening/merging a PR.
5. Run lint and fix issues.

### Common commands (from `packages/spacecat-shared-data-access`)

### Run unit tests

```bash
npm test
```

### Run unit tests with debugger

```bash
npm run test:debug
```

### Run integration tests

```bash
npm run test:it
```

### Run lint

```bash
npm run lint
```

### Auto-fix lint issues

```bash
npm run lint:fix
```

### Clean local install artifacts

```bash
npm run clean
```

The integration suite under `test/it` is PostgREST-based and runs via Docker.

## Integration Tests

Integration tests run a local Postgres + PostgREST stack via Docker Compose and execute
the mocha suite under `test/it`.

### Prerequisites

- Docker Desktop (or equivalent Docker daemon)
- AWS CLI configured with credentials that can access the Spacecat Development AWS account
  ECR repository (only needed when pulling the default private ECR image)

### Default image used by IT harness

- Repository: `682033462621.dkr.ecr.us-east-1.amazonaws.com/mysticat-data-service`
- Tag: `v1.11.0` (override via env var)

### Authenticate Docker to ECR

The default image is in a private ECR repo in:
- **SpaceCat Development (AWS3338)**

If you are setting this up for the first time:
1. Get AWS credentials for **SpaceCat Development (AWS3338)** from `klam.corp.adobe.com`.
2. Add them to `~/.aws/credentials` under a profile name you choose.
3. Use that profile in the ECR login command.

Example `~/.aws/credentials` entry:

```ini
[spacecat-dev]
aws_access_key_id = <your-access-key-id>
aws_secret_access_key = <your-secret-access-key>
```

Repository:

- `682033462621.dkr.ecr.us-east-1.amazonaws.com/mysticat-data-service`

Then authenticate Docker to ECR:

```bash
aws ecr get-login-password --profile spacecat-dev --region us-east-1 \
  | docker login --username AWS --password-stdin 682033462621.dkr.ecr.us-east-1.amazonaws.com
```

### Run

```bash
npm run test:it
```

### Useful overrides

- `MYSTICAT_DATA_SERVICE_TAG`: override image tag (recommended for version bumps)
- `MYSTICAT_DATA_SERVICE_REPOSITORY`: override image repository
- `MYSTICAT_DATA_SERVICE_PLATFORM`: override container platform (default `linux/amd64`)
- `IT_POSTGREST_PORT`: override exposed PostgREST port (default `3300`)
- `IT_POSTGRES_PORT`: override exposed Postgres port (default `55432`)

```bash
export MYSTICAT_DATA_SERVICE_TAG=v1.11.0
export MYSTICAT_DATA_SERVICE_PLATFORM=linux/amd64
# optional if repository changes
export MYSTICAT_DATA_SERVICE_REPOSITORY=682033462621.dkr.ecr.us-east-1.amazonaws.com/mysticat-data-service
```

## TypeScript

Type definitions are shipped from:
- `src/index.d.ts`
- `src/models/**/index.d.ts`

Use the package directly in TS projects; no extra setup required.

## License

Apache-2.0
