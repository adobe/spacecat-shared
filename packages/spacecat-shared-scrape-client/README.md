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
  processingType: 'default' // Optional, defaults to 'DEFAULT'
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
