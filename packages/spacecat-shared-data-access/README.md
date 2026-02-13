# Spacecat Shared Data Access

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

## V3 Behavior Notes

- `Configuration` remains S3-backed in v3.
- `KeyEvent` is deprecated in v3 and intentionally throws on access/mutation methods.
- `LatestAudit` is virtual in v3 and derived from `Audit` queries (no dedicated table required).

## Migrating from V2

If you are upgrading from DynamoDB/ElectroDB-based v2:

### What stays the same

- You still use `createDataAccess(...)`.
- You still access collections through `dataAccess.<Entity>` (for example `dataAccess.Site`).
- Model/collection APIs are intended to stay stable for service callers.

### What changes

- Backing store is now Postgres via PostgREST, not DynamoDB/ElectroDB.
- You must provide `postgrestUrl` (or `POSTGREST_URL` via wrapper env).
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

### Run unit tests

```bash
npm test
```

### Run integration tests

```bash
npm run test:it
```

The integration suite under `test/it` is PostgREST-based and runs via Docker.

Default data-service image:
- `682033462621.dkr.ecr.us-east-1.amazonaws.com/mysticat-data-service:v1.7.1`

If needed, override:

```bash
export MYSTICAT_DATA_SERVICE_IMAGE=<image:tag>
```

If you use the default private ECR image, authenticate first:

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 682033462621.dkr.ecr.us-east-1.amazonaws.com
```

## TypeScript

Type definitions are shipped from:
- `src/index.d.ts`
- `src/models/**/index.d.ts`

Use the package directly in TS projects; no extra setup required.

## License

Apache-2.0
