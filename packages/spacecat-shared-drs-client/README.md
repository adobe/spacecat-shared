# Spacecat Shared - DRS Client

A JavaScript client for the DRS (Data Retrieval Service) API, part of the SpaceCat Shared library.
It allows you to submit scrape jobs to DRS, poll for their completion, and retrieve results.

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

The context must have `DRS_API_URL` and `DRS_API_KEY` in `context.env`.

### Constructor

```js
import DrsClient from '@adobe/spacecat-shared-drs-client';

const client = new DrsClient({
  apiBaseUrl: 'https://drs-api.example.com',
  apiKey: '<API_KEY>',
});
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

```js
const status = await client.getJobStatus('job-123');
console.log(status.status); // 'QUEUED', 'RUNNING', 'COMPLETED', or 'FAILED'
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

```js
const lookupResult = await client.lookupUrls(requestBody);
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
