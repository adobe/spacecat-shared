# Spacecat Shared - DRS Client

A JavaScript client for the DRS (Data Retrieval Service) API, part of the SpaceCat Shared library.
It allows you to submit data retrieval jobs to DRS, poll for their completion, look up previously
retrieved URLs, and download results via presigned S3 URLs.

## Installation

Install the package using npm:

```bash
npm install @adobe/spacecat-shared-drs-client
```

## Usage

### Creating an instance from Helix UniversalContext

```js
import DrsClient from '@adobe/spacecat-shared-drs-client';

const client = DrsClient.createFrom(context);
```

The context must have the following environment variables in `context.env`:

| Variable | Description |
|---|---|
| `DRS_API_URL` | DRS API base URL |
| `DRS_API_KEY` | DRS API key |

### Constructor

```js
import DrsClient from '@adobe/spacecat-shared-drs-client';

const client = new DrsClient({
  apiBaseUrl: 'https://drs-api.example.com',
  apiKey: '<API_KEY>',
});
```

### Exported Constants

```js
import { VALID_DATASET_IDS, JOB_STATUSES } from '@adobe/spacecat-shared-drs-client';

// ['youtube_videos', 'youtube_comments', 'reddit_posts', 'reddit_comments', 'wikipedia']
console.log(VALID_DATASET_IDS);

// { QUEUED: 'QUEUED', RUNNING: 'RUNNING', COMPLETED: 'COMPLETED', FAILED: 'FAILED' }
console.log(JOB_STATUSES);
```

### Submitting a Job

```js
const response = await client.submitJob({
  datasetId: 'youtube_videos',
  urls: ['https://www.youtube.com/watch?v=abc123'],
  metadata: {
    imsOrgId: 'your-org-id',
    brand: 'your-brand',
    site: 'your-brand.com',
  },
});
console.log(response.job_id); // 'job-123'
```

### Getting Job Status

Returns the current status of a job. When the job is completed, the response
includes a presigned S3 URL for downloading the results.

```js
const status = await client.getJobStatus('job-123');
console.log(status.status); // 'QUEUED', 'RUNNING', 'COMPLETED', or 'FAILED'

if (status.status === 'COMPLETED') {
  console.log(status.result_url); // presigned S3 download URL
  console.log(status.result_url_expires_in); // URL expiry in seconds
}
```

### Polling for Job Completion

```js
const result = await client.pollJobStatus('job-123', {
  pollIntervalMs: 15000, // default: 15s
  maxTimeoutMs: 600000,  // default: 10min
});
console.log(result.status); // 'COMPLETED' or 'FAILED'
```

### Looking Up URLs

Check the availability of previously retrieved URLs. Each URL in the response
will have a status of `available`, `scraping`, or `not_found`.

```js
const result = await client.lookupUrls([
  'https://www.reddit.com/r/technology/comments/abc123/post_title/',
  'https://www.reddit.com/r/webdev/comments/def456/another_post/',
]);

// Per-URL results
for (const entry of result.results) {
  if (entry.status === 'available') {
    console.log(entry.presigned_url); // presigned S3 download URL
    console.log(entry.expires_in);    // URL expiry in seconds
  } else if (entry.status === 'scraping') {
    console.log(entry.job_id);        // in-progress job ID
  } else {
    console.log(entry.message);       // 'not_found' guidance
  }
}

// Summary counts
console.log(result.summary);
// { total: 2, available: 1, scraping: 1, not_found: 0 }
```

## Testing

To run tests:

```bash
npm run test
```

## Linting

Lint your code:

```bash
npm run lint
```

## Cleaning

To remove `node_modules` and `package-lock.json`:

```bash
npm run clean
```

## Additional Information

- **Repository**: [GitHub](https://github.com/adobe/spacecat-shared.git)
- **Issue Tracking**: [GitHub Issues](https://github.com/adobe/spacecat-shared/issues)
- **License**: Apache-2.0
