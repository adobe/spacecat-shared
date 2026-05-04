# Implementation Plan: Geo-Brand-Presence DRS SNS Migration (PR B — `spacecat-shared`)

## Context

The `spacecat-audit-worker` (PR D) is migrating from calling DRS's HTTP endpoint
`POST /sites/{siteId}/brand-presence/analyze` to a direct S3 upload + SNS publish pattern.
This repo (PR B) must add two new methods to `DrsClient` to support that.

**New flow:**
1. Audit worker downloads Excel from SharePoint
2. Calls `drsClient.uploadExcelToDrs(...)` → `PutObject` to DRS S3 bucket at `external/spacecat/{siteId}/{brandSlug}/{jobId}/source.xlsx`
3. Calls `drsClient.publishBrandPresenceAnalyze(...)` → publishes `JOB_COMPLETED` SNS message to `DRS_SNS_TOPIC_ARN`
4. DRS's new Lambda (PR A) picks it up, creates a synthetic DynamoDB job, and triggers Fargate

The SNS message format is derived from DRS's existing `_publish_analysis_sns` function in
`src/pipelines/brand_presence/handlers/brand_presence_analyze.py`.

**Cross-repo PRs:**
- **PR A** (`adobe-rnd/llmo-data-retrieval-service`) — extends `fargate_trigger.py`; deletes HTTP endpoint
- **PR B** (this repo) — adds `uploadExcelToDrs()` and `publishBrandPresenceAnalyze()` to `DrsClient`
- **PR C** (`spacecat-infrastructure`) — IAM policy updates for S3/SNS access + new env vars
- **PR D** (`spacecat-audit-worker`) — replaces Mystique callback with direct DRS integration; depends on B and C

---

## Step 1 — Add AWS SDK dependencies to `package.json`

File: `packages/spacecat-shared-drs-client/package.json`

Add to `dependencies`:
```json
"@aws-sdk/client-s3": "^3.x.x",
"@aws-sdk/client-sns": "^3.x.x"
```

> `instrumentAWSClient` is already available via the existing `@adobe/spacecat-shared-utils`
> dependency — no new import needed for that.

---

## Step 2 — New environment variables

Two new env vars are required. Both must be provisioned in PR C (infrastructure/CDK) alongside
the existing `DRS_API_URL` and `DRS_API_KEY`.

| Env var | New? | Purpose |
|---|---|---|
| `DRS_API_URL` | existing | HTTP API base URL |
| `DRS_API_KEY` | existing | API key for HTTP requests |
| `DRS_S3_BUCKET` | **new** | DRS bucket name SpaceCat uploads into |
| `DRS_SNS_TOPIC_ARN` | **new** | DRS job-notifications topic SpaceCat publishes to |
| `AWS_REGION` | existing | Standard Lambda env var, already consumed by `s3Wrapper` in `spacecat-shared-utils` |

PR C must also grant IAM permissions to the audit worker Lambda:
- `s3:PutObject` on `arn:aws:s3:::${DRS_S3_BUCKET}/external/spacecat/*`
- `sns:Publish` on `${DRS_SNS_TOPIC_ARN}`

If `DRS_S3_BUCKET` or `DRS_SNS_TOPIC_ARN` are absent at runtime, `isS3Configured()` returns
false and both new methods throw early — existing HTTP method behaviour is unaffected.

---

## Step 3 — Extend `DrsClient` in `src/index.js`

File: `packages/spacecat-shared-drs-client/src/index.js`

### 3a. New imports at the top
```js
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { hasText, instrumentAWSClient } from '@adobe/spacecat-shared-utils';
```

### 3b. New constants
```js
const EXTERNAL_SPACECAT_PROVIDER_ID = 'external_spacecat';
const DRS_S3_KEY_PREFIX = 'external/spacecat';
```

### 3c. Update constructor signature and body
```js
constructor({ apiBaseUrl, apiKey, s3Bucket, snsTopicArn, awsRegion, s3Client, snsClient }, log = console) {
  // existing url stripping ...
  this.s3Bucket = s3Bucket;
  this.snsTopicArn = snsTopicArn;
  this.s3Client = s3Client ?? instrumentAWSClient(new S3Client({ region: awsRegion }));
  this.snsClient = snsClient ?? instrumentAWSClient(new SNSClient({ region: awsRegion }));
}
```

`s3Client`/`snsClient` are optional injection points for sinon stubs in tests.

### 3d. Update `createFrom()`
```js
const {
  DRS_API_URL: apiBaseUrl,
  DRS_API_KEY: apiKey,
  DRS_S3_BUCKET: s3Bucket,
  DRS_SNS_TOPIC_ARN: snsTopicArn,
  AWS_REGION: awsRegion,
} = env;
```

### 3e. Add `isS3Configured()` method
```js
isS3Configured() {
  return hasText(this.s3Bucket) && hasText(this.snsTopicArn);
}
```

### 3f. Add `uploadExcelToDrs({ siteId, brandSlug, jobId, excelBuffer })`
- Validates `siteId`, `jobId`, `excelBuffer` are present; `isS3Configured()` is true
- Builds key: `` `${DRS_S3_KEY_PREFIX}/${siteId}/${brandSlug}/${jobId}/source.xlsx` ``
- Calls:
```js
s3Client.send(new PutObjectCommand({
  Bucket: this.s3Bucket,
  Key: key,
  Body: excelBuffer,
  ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ServerSideEncryption: 'AES256',
}))
```
- Returns S3 URI: `` `s3://${this.s3Bucket}/${key}` ``

### 3g. Add `publishBrandPresenceAnalyze({ jobId, siteId, brandName, imsOrgId, resultLocation, platform, week, year })`
- Validates required fields (`jobId`, `siteId`, `resultLocation`) and `isS3Configured()`
- Builds message matching DRS's `_publish_analysis_sns` format exactly:
```js
{
  event_type: 'JOB_COMPLETED',
  job_id: jobId,
  provider_id: EXTERNAL_SPACECAT_PROVIDER_ID,
  result_location: resultLocation,
  reanalysis: true,
  metadata: { site: siteId, brand: brandName, imsOrgId },
  ...(platform && { platform }),
  ...(week != null && { week }),
  ...(year != null && { year }),
}
```
- Calls:
```js
snsClient.send(new PublishCommand({
  TopicArn: this.snsTopicArn,
  Message: JSON.stringify(message),
  MessageAttributes: {
    event_type: { DataType: 'String', StringValue: 'JOB_COMPLETED' },
    provider_id: { DataType: 'String', StringValue: EXTERNAL_SPACECAT_PROVIDER_ID },
  },
}))
```

---

## Step 4 — Update TypeScript declarations in `src/index.d.ts`

File: `packages/spacecat-shared-drs-client/src/index.d.ts`

Add to `DrsClientConfig`:
```ts
s3Bucket?: string;
snsTopicArn?: string;
awsRegion?: string;
```

Add new interfaces:
```ts
interface UploadExcelParams {
  siteId: string;
  brandSlug: string;
  jobId: string;
  excelBuffer: Buffer | Uint8Array;
}

interface PublishBrandPresenceParams {
  jobId: string;
  siteId: string;
  brandName?: string;
  imsOrgId?: string;
  resultLocation: string;
  platform?: string;
  week?: number;
  year?: number;
}
```

Add to `DrsClient` declaration:
```ts
isS3Configured(): boolean;
uploadExcelToDrs(params: UploadExcelParams): Promise<string>;
publishBrandPresenceAnalyze(params: PublishBrandPresenceParams): Promise<void>;
```

---

## Step 5 — Update tests in `test/index.test.js`

File: `packages/spacecat-shared-drs-client/test/index.test.js`

Inject stubbed AWS clients via constructor for all new-method tests:

```js
let s3ClientStub, snsClientStub;
beforeEach(() => {
  s3ClientStub = { send: sinon.stub() };
  snsClientStub = { send: sinon.stub() };
  client = new DrsClient(
    { ...config, s3Bucket, snsTopicArn, s3Client: s3ClientStub, snsClient: snsClientStub },
    log,
  );
});
```

### `isS3Configured` tests
- missing bucket → false
- missing topicArn → false
- both set → true

### `uploadExcelToDrs` tests
- Success: verifies `PutObjectCommand` called with correct bucket/key/ContentType/ServerSideEncryption; returns correct S3 URI
- Not configured (`isS3Configured()` false): throws
- Missing `siteId`/`jobId`/`excelBuffer`: throws
- S3 `send` throws: error propagates

### `publishBrandPresenceAnalyze` tests
- Success: verifies `PublishCommand` called with correct TopicArn, message shape
  (`event_type`, `provider_id`, `result_location`, `reanalysis: true`, metadata), and MessageAttributes
- Optional fields (`platform`, `week`, `year`): present when passed, absent when not
- Not configured: throws
- Missing required fields (`jobId`, `siteId`, `resultLocation`): throws
- SNS `send` throws: error propagates

### Updated `createFrom` tests
- Reads `DRS_S3_BUCKET` and `DRS_SNS_TOPIC_ARN` from env and passes them through

---

## Step 6 — Verify 100% coverage

```bash
npm test -w packages/spacecat-shared-drs-client
```

The `.nycrc.json` requires 100% lines/statements and 97% branches. Every new branch
(optional params, error guards) must have a corresponding test.

---

## Deployment order

This PR (B) must be **published before** the audit worker PR (D) can be merged.
`DRS_S3_BUCKET`, `DRS_SNS_TOPIC_ARN`, and the IAM grants must land in the infrastructure
PR (C) before the audit worker goes live.
