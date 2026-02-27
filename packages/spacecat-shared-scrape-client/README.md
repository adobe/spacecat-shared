# Spacecat Shared - Scrape Client


A JavaScript client for managing web scraping jobs, part of the SpaceCat Shared library. The ScrapeClient provides a comprehensive interface for creating, monitoring, and retrieving results from web scraping operations without needing to access the SpaceCat API service directly.

## Installation

Install the package using npm:

```bash
npm install @adobe/spacecat-shared-scrape-client
```

## Features

- **Create Scrape Jobs**: Submit URLs for web scraping with customizable options
- **Job Monitoring**: Track job status and progress
- **Result Retrieval**: Get detailed results for completed scraping jobs
- **Date Range Queries**: Find jobs within specific time periods
- **Base URL Filtering**: Search jobs by domain or base URL
- **Processing Type Support**: Different scraping strategies and configurations
- **Custom Headers**: Add custom HTTP headers for scraping requests
- **Error Handling**: Comprehensive validation and error reporting

## Usage

### Creating an Instance

#### Method 1: Direct Constructor

```js
import { ScrapeClient } from '@adobe/spacecat-shared-scrape-client';

const config = {
  dataAccess: dataAccessClient,    // Data access layer
  sqs: sqsClient,                  // SQS client for job queuing
  env: environmentVariables,       // Environment configuration
  log: logger                      // Logging interface
};

const client = new ScrapeClient(config);
```

#### Method 2: From Helix Universal Context

```js
import { ScrapeClient } from '@adobe/spacecat-shared-scrape-client';

const context = {
  dataAccess: context.dataAccess,
  sqs: context.sqs,
  env: context.env,
  log: context.log
};

const client = ScrapeClient.createFrom(context);
```

### Creating a Scrape Job

```js
const jobData = {
  urls: ['https://example.com/page1', 'https://example.com/page2'],
  options: {},
  customHeaders: {
    // Custom HTTP headers (optional)
    'Authorization': 'Bearer token',
    'X-Custom-Header': 'value'
  },
  processingType: 'default', // Optional, defaults to 'DEFAULT'
  maxScrapeAge: 6, // Optional, used to avoid re-scraping recently scraped URLs (hours) 0 means always scrape
  auditData: {} // Optional, this is used for step audits
};

try {
  const job = await client.createScrapeJob(jobData);
  console.log('Job created:', job.id);
  console.log('Job status:', job.status);
} catch (error) {
  console.error('Failed to create job:', error.message);
}
```

### Checking Job Status

```js
const jobId = 'your-job-id';

try {
  const jobStatus = await client.getScrapeJobStatus(jobId);
  if (jobStatus) {
    console.log('Job Status:', jobStatus.status);
    console.log('URL Count:', jobStatus.urlCount);
    console.log('Success Count:', jobStatus.successCount);
    console.log('Failed Count:', jobStatus.failedCount);
    console.log('Duration:', jobStatus.duration);
  } else {
    console.log('Job not found');
  }
} catch (error) {
  console.error('Failed to get job status:', error.message);
}
```

### Getting Job Results

```js
const jobId = 'your-job-id';

try {
  const results = await client.getScrapeJobUrlResults(jobId);
  if (results) {
    results.forEach(result => {
      console.log(`URL: ${result.url}`);
      console.log(`Status: ${result.status}`);
      console.log(`Reason: ${result.reason}`);
      console.log(`Path: ${result.path}`);
    });
  } else {
    console.log('Job not found');
  }
} catch (error) {
  console.error('Failed to get job results:', error.message);
}
```

### Getting Successful Scrape Paths

```js
const jobId = 'your-job-id';
try {
  const paths = await client.getScrapeResultPaths(jobId);
  if (paths === null) {
    console.log('Job not found');
  } else if (paths.size === 0) {
    console.log('No successful paths found for this job');
  } else {
    console.log(`Found ${paths.size} successful paths for job ${jobId}`);
    for (const [url, path] of paths) {
      console.log(`URL: ${url} -> Path: ${path}`);
    }
  }
} catch (error) {
  console.error('Failed to get successful paths:', error.message);
}
```

### Finding Jobs by Date Range

```js
const startDate = '2024-01-01T00:00:00Z';
const endDate = '2024-01-31T23:59:59Z';

try {
  const jobs = await client.getScrapeJobsByDateRange(startDate, endDate);
  console.log(`Found ${jobs.length} jobs in date range`);
  jobs.forEach(job => {
    console.log(`Job ${job.id}: ${job.status} - ${job.baseURL}`);
  });
} catch (error) {
  console.error('Failed to get jobs by date range:', error.message);
}
```

### Finding Jobs by Base URL

```js
const baseURL = 'https://example.com';

try {
  // Get all jobs for a base URL
  const allJobs = await client.getScrapeJobsByBaseURL(baseURL);
  console.log(`Found ${allJobs.length} jobs for ${baseURL}`);

  // Get jobs for a specific processing type
  const specificJobs = await client.getScrapeJobsByBaseURL(baseURL, 'form');
  console.log(`Found ${specificJobs.length} jobs with custom processing`);
} catch (error) {
  console.error('Failed to get jobs by base URL:', error.message);
}
```

## Job Response Format

When you retrieve a scrape job, it returns an object with the following structure:

```js
{
  id: "job-id",
  baseURL: "https://example.com",
  processingType: "default",
  options: { /* scraping options */ },
  startedAt: "2024-01-01T10:00:00Z",
  endedAt: "2024-01-01T10:05:00Z",
  duration: 300000, // milliseconds
  status: "COMPLETE",
  urlCount: 10,
  successCount: 8,
  failedCount: 2,
  redirectCount: 0,
  customHeaders: { /* custom headers used */ }
}
```

## URL Results Format

When you retrieve job results, each URL result has this structure:

```js
{
  url: "https://example.com/page",
  status: "SUCCESS",
  reason: "in case there was an error, you will this this here",
  path: "/s3/path/to/scraped/content"
}
```

## Path Results Format

When you retrieve successful scrape paths using `getScrapeResultPaths()`, the response is a JavaScript Map object that maps URLs to their corresponding result file paths. Only URLs with `COMPLETE` status are included:

```js
Map(2) {
  'https://example.com/page1' => 'path/to/result1',
  'https://example.com/page2' => 'path/to/result2'
}
```

## Configuration

The client uses the `SCRAPE_JOB_CONFIGURATION` environment variable for default settings:

```js
// Example configuration
{
  "maxUrlsPerJob": 5,
  "options": {
    "enableJavascript": true,
    "hideConsentBanner": true,
  }
}
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

Fix linting issues:

```bash
npm run lint:fix
```

## Cleaning

To remove `node_modules` and `package-lock.json`:

```bash
npm run clean
```

## Dependencies

- `@adobe/helix-universal`: Universal context support
- `@adobe/spacecat-shared-data-access`: Data access layer
- `@adobe/spacecat-shared-utils`: Utility functions

## Additional Information

- **Repository**: [GitHub](https://github.com/adobe/spacecat-shared.git)
- **Issue Tracking**: [GitHub Issues](https://github.com/adobe/spacecat-shared/issues)
- **License**: Apache-2.0

### ScrapeClient Workflow Overview

<img width="889" height="508" alt="Screenshot 2025-08-27 at 08 56 16" src="https://github.com/user-attachments/assets/9ccc1388-ed6b-4bf0-a059-d40e6e90aff8" />

When a new scrape job is created, the client performs the following steps:
1. Creates a new job entry in the database with status `PENDING`.
2. Splits the provided URLs into batches based on the `maxUrlsPerMessage` configuration (this is limited due to SQS message size constraints).
3. For each batch, it creates a message in the SQS queue to the scrape-job-manager.

In the scrape-job-manager the following steps are performed:
1. All existing ScrapeURLs are fetched for the base URL to avoid re-scraping recently scraped URLs (based on the `maxScrapeAge` parameter).
2. For all URLs a new ScrapeURL entry is created with status `PENDING`.
3. Each URL in the batch is checked against existing ScrapeURLs.
   - Already scraped URLs (with status 'COMPLETE' or 'PENDING') are marked to be skipped with the ID of the existing ScrapeURL and the isOriginal flag set to false.
   - URLs that need to be scraped are marked with the isOriginal flag set to true. (The isOriginal flag is used to avoid the sliding window problem when re-scraping URLs.)
   - All URLs are numbered with based on their position in the original list to be able to track the job progress.
4. For each URL, a message is created in the SQS queue to the content-scraper.

In the content-scraper the following steps are performed:
1. The content-scraper checks if an incoming URL message is marked to be skipped. If so, it just sends a message to the content-processor.
2. If the URL is not marked to be skipped, the content-scraper scrapes the URL.
3. The content-scraper creates a message in the SQS queue to the content-processor with the result of the scraping operation.

in the content-processor the following steps are performed:
1. The content-processor processes the incoming message from the content-scraper.
2. If the URL was skipped, it fetches the existing ScrapeURL entry and updates the new ScrapeURL entry with the same path and status.
3. If the URL was scraped, it updates the ScrapeURL entry with the result of the scraping operation (status, path, reason).
4. The content-processor updates the ScrapeJob entry with the new counts (success, failed, redirect).
5. If all URLs of a job are processed (based on their number and the totalUrlCount of the job), it:
    - performs a cleanup step to set all PENDING URLs to FAILED that were not processed (e.g. due to timeouts).
    - updates the counts of the job again.
    - sets the job status to COMPLETE and sets the endedAt timestamp.
    - Optionally, it can send a SQS message (e.g. to trigger the next audit step).

  
Example with completionMessage

<img width="871" height="469" alt="Screenshot 2025-08-28 at 12 16 29" src="https://github.com/user-attachments/assets/84503b37-05cc-44e9-bcb5-29f8dffff234" />
