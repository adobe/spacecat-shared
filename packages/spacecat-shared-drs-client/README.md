# Spacecat Shared - DRS Client

A JavaScript client for the Data Retrieval Service (DRS) API, part of the SpaceCat Shared library. It supports job submission (prompt generation, web scraping), scrape result lookups, and brand detection triggers.

## Installation

Install the package using npm:

```bash
npm install @adobe/spacecat-shared-drs-client
```

## Configuration

Set the following environment variables:

- `DRS_API_URL` — Base URL of the DRS API
- `DRS_API_KEY` — API key for authentication

## Usage

### Creating an instance from Helix UniversalContext

```js
import DrsClient from '@adobe/spacecat-shared-drs-client';

const client = DrsClient.createFrom(context);
```

### Constructor

```js
import DrsClient from '@adobe/spacecat-shared-drs-client';

const client = new DrsClient({
  apiBaseUrl: '<DRS_API_URL>',
  apiKey: '<DRS_API_KEY>',
}, log);
```

### Methods

#### submitScrapeJob(params)

Submits a web scraping job via the Bright Data provider.

```js
import { SCRAPE_DATASET_IDS } from '@adobe/spacecat-shared-drs-client';

const result = await client.submitScrapeJob({
  datasetId: SCRAPE_DATASET_IDS.YOUTUBE_VIDEOS,
  siteId: 'site-uuid',
  urls: ['https://www.youtube.com/watch?v=abc123'],
  priority: 'HIGH', // optional, defaults to 'HIGH'. Also accepts 'LOW'
});
// Returns: { job_id: '...', ... }
```

Valid `datasetId` values (available via `SCRAPE_DATASET_IDS`):
- `youtube_videos`
- `youtube_comments`
- `reddit_posts`
- `reddit_comments`
- `wikipedia`

#### lookupScrapeResults(params)

Looks up scraping results for an array of URLs.

```js
const lookup = await client.lookupScrapeResults({
  datasetId: SCRAPE_DATASET_IDS.REDDIT_POSTS,
  siteId: 'site-uuid',
  urls: ['https://www.reddit.com/r/technology/comments/abc123/post_title/'],
});
// Returns:
// {
//   results: [
//     { url: '...', status: 'available', presigned_url: '...', scraped_at: '...', expires_in: 3600 },
//     { url: '...', status: 'scraping', job_id: '...', message: '...' },
//     { url: '...', status: 'not_found', message: '...' },
//   ],
//   summary: { total: 3, available: 1, scraping: 1, not_found: 1 }
// }
```

#### submitPromptGenerationJob(params)

Submits a prompt generation job.

```js
const result = await client.submitPromptGenerationJob({
  baseUrl: 'https://example.com',
  brandName: 'Example',
  audience: 'consumers',
  siteId: 'site-uuid',
  imsOrgId: 'org-uuid',
  region: 'US',       // optional, defaults to 'US'
  numPrompts: 50,     // optional, defaults to 50
  source: 'onboarding', // optional, defaults to 'onboarding'
});
```

#### triggerBrandDetection(siteId, options?)

Triggers brand detection re-analysis for a site.

```js
await client.triggerBrandDetection('site-uuid', { batchId: 'batch-abc', priority: 'HIGH' });
```

#### getJob(jobId)

Retrieves job status and details.

```js
const job = await client.getJob('job-uuid');
```

#### submitJob(params)

Submits a generic job to DRS. Used internally by the higher-level methods, but available for custom job types.

```js
const result = await client.submitJob({
  provider_id: 'custom-provider',
  parameters: { /* ... */ },
});
```

## Testing

To run tests:

```bash
npm test
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
