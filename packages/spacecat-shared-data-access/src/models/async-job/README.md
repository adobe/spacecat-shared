# AsyncJob Entity for Asynchronous HTTP APIs

## Use Case

The `AsyncJob` entity is designed to support asynchronous HTTP APIs, such as those commonly implemented on AWS with API Gateway and Lambda. In this pattern:

- **Client submits a job** (e.g., a long-running computation or export) via an HTTP endpoint. The API returns HTTP 202 (Accepted) and a Job ID.
- **Client polls for job status** using the Job ID.
- **Client retrieves the result** when the job is completed, either inline or via a URL (e.g., S3).

This pattern is ideal for workflows where immediate results are not possible, and the client must check back later for completion.

## AsyncJob Schema Overview

The `AsyncJob` entity persists the state and metadata of each asynchronous job. Key attributes include:

- `asyncJobId`: Unique identifier (UUID v4) for the job.
- `status`: Job lifecycle status (`IN_PROGRESS`, `COMPLETED`, `FAILED`, `CANCELLED`).
- `createdAt`, `updatedAt`: Timestamps for auditing and sorting.
- `startedAt`, `endedAt`: Timestamps for when the job actually started and finished. Set automatically when job is created.
- `expiresAt`: ISO timestamp (persisted to the `expires_at` column) at which the job becomes eligible for cleanup. Set automatically to `createdAt + 7 days`. Expired rows are purged by the Mystique `AsyncJobReaper` via `wrpc_purge_expired_async_jobs` (SITES-47947 / SITES-47948); for preflight jobs, the linked `preflights` row cascades on delete.
- `recordExpiresAt`: **Legacy** virtual field (Unix epoch seconds) — a carryover from the retired DynamoDB TTL. **Not persisted** to Postgres; kept only for backward compatibility of the V1 preflight response. Use `expiresAt` for the actual TTL.
- `resultLocation`: URL or S3 URI where the result can be retrieved, or empty if not available.
- `resultType`: Optional. One of `S3`, `INLINE`, `URL`, or `null` if no result yet.
- `result`: Inline result data (if small enough), or `null`.
- `error`: Structured error object if the job failed.
- `metadata`: Arbitrary metadata (e.g., who submitted the job, job type, tags).

### Best Practices
- `resultType` is optional and should only be set when a result is available. For jobs in progress, leave it `null` or unset.
- Records auto-expire 7 days after creation via `expiresAt` and are cleaned up by the `AsyncJobReaper` — no action needed. (`recordExpiresAt` is a non-persisted legacy field; do not rely on it.)
- Use `metadata` for extensibility (e.g., tracking submitter, job type, or tags).

## Usage Example

```js
const { AsyncJob } = dataAccess;

// 1. Submit a new async job
const job = await AsyncJob.create({
  status: 'IN_PROGRESS',
  metadata: { submittedBy: 'user123', jobType: 'export', tags: ['export'] },
});

// 2. Poll for job status
const polledJob = await AsyncJob.findById(job.getId());
if (polledJob.getStatus() === 'COMPLETED') {
  // 3. Retrieve result
  if (polledJob.getResultType() === 'S3') {
    // Download from S3
    const s3Url = polledJob.getResultLocation();
    // ...
  } else if (polledJob.getResultType() === 'INLINE') {
    const result = polledJob.getResult();
    // ...
  }
} else if (polledJob.getStatus() === 'FAILED') {
  const error = polledJob.getError();
  // Handle error
}
```

## When to Use AsyncJob
- For any API where work is performed asynchronously and clients must check back for results.
- For workflows where results may be large (S3), small (inline), or may fail and need error reporting.
- For jobs that should expire and be cleaned up automatically.

See the `AsyncJob` model, schema, and integration/unit tests for more details and usage patterns. 