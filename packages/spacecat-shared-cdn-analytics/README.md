# SpaceCat Shared CDN Analytics

A shared library for analyzing CDN traffic data using SQL templates and AWS Athena.

## Features

- **SQL Template Engine**: Execute predefined SQL templates with customizable parameters
- **Athena Integration**: Execute optimized SQL queries against CDN log data
- **Multiple Analysis Types**: Support for various traffic analysis patterns
- **User Agent Filtering**: Built-in patterns for filtering bot traffic and AI agents
- **Configurable**: Flexible configuration for different site types and patterns

## Installation

```bash
npm install @adobe/spacecat-shared-cdn-analytics
```

## Quick Start

```javascript
import { CdnAnalyticsService } from '@adobe/spacecat-shared-cdn-analytics';

// Initialize the service
const service = new CdnAnalyticsService(context, site);

// Execute a template with parameters
const result = await service.executeTemplate('user-agent-weekly-breakdown', {
  whereClause: 'WHERE week_start_date >= \'2025-01-01\'',
  weekColumns: 'SUM(total_requests) as total_requests',
  orderBy: 'total_requests',
  agentFilter: 'chatgpt'
});

console.log(result.results);
```

## Available Templates

### Weekly Analysis Templates

#### `user-agent-weekly-breakdown`
Analyze user agent patterns and traffic breakdown.

**Parameters:**
- `whereClause`: SQL WHERE clause for filtering
- `weekColumns`: Column aggregation expressions
- `orderBy`: Column to order results by
- `agentFilter`: Filter by agent type (`chatgpt`, `perplexity`, `claude`, `gemini`, `copilot`, `all`)

**Example:**
```javascript
const result = await service.executeTemplate('user-agent-weekly-breakdown', {
  whereClause: 'WHERE week_start_date >= \'2025-01-01\'',
  weekColumns: 'SUM(total_requests) as total_requests',
  orderBy: 'total_requests',
  agentFilter: 'chatgpt'
});
```

#### `country-weekly-breakdown`
Analyze traffic distribution by country/region.

**Parameters:**
- `whereClause`: SQL WHERE clause for filtering
- `weekColumns`: Column aggregation expressions
- `orderBy`: Column to order results by
- `countryExtraction`: Expression for extracting country codes

**Example:**
```javascript
const result = await service.executeTemplate('country-weekly-breakdown', {
  whereClause: 'WHERE week_start_date >= \'2025-01-01\'',
  weekColumns: 'SUM(total_requests) as total_requests',
  orderBy: 'total_requests',
  countryExtraction: 'country_code'
});
```

#### `top-urls-weekly-breakdown`
Analyze top URLs by traffic volume.

**Parameters:**
- `whereClause`: SQL WHERE clause for filtering
- `weekColumns`: Column aggregation expressions
- `orderBy`: Column to order results by

#### `error-urls-weekly-breakdown`
Analyze URLs with error status codes.

**Parameters:**
- `whereClause`: SQL WHERE clause for filtering
- `weekColumns`: Column aggregation expressions
- `orderBy`: Column to order results by
- `statusFilter`: Filter by HTTP status code (e.g., `404`, `500`)

#### `page-type-weekly-breakdown`
Analyze traffic by page type classification.

**Parameters:**
- `whereClause`: SQL WHERE clause for filtering
- `weekColumns`: Column aggregation expressions
- `orderBy`: Column to order results by

#### `url-analysis-weekly`
Comprehensive URL analysis with detailed metrics.

**Parameters:**
- `whereClause`: SQL WHERE clause for filtering
- `weekColumns`: Column aggregation expressions
- `orderBy`: Column to order results by

## API Reference

### CdnAnalyticsService

Main service class for CDN analytics operations.

#### Constructor

```javascript
new CdnAnalyticsService(context, site)
```

- `context`: Request context with logging and AWS configuration
- `site`: Site object with configuration and URLs

#### Methods

##### `executeTemplate(templateName, parameters)`

Execute a SQL template with the provided parameters.

**Parameters:**
- `templateName` (string): Name of the SQL template to execute
- `parameters` (Object): Template parameters and filters

**Returns:**
- `Promise<Object>`: Execution results with metadata

**Result Structure:**
```javascript
{
  templateName: "user-agent-weekly-breakdown",
  parameters: { /* resolved parameters */ },
  sql: "SELECT ...", // The executed SQL query
  results: [
    { user_agent: "GoogleBot", total_requests: "12345" },
    // ... more results
  ],
  resultCount: 42,
  executedAt: "2025-01-15T10:30:00Z"
}
```

##### `getAvailableTemplates()`

Get list of available SQL templates.

**Returns:**
- `Array<string>`: Available template names

**Example:**
```javascript
const templates = service.getAvailableTemplates();
// Returns: ['user-agent-weekly-breakdown', 'top-urls-weekly-breakdown', ...]
```

##### `initialize()`

Initialize the service with Athena client. Called automatically when needed.

**Returns:**
- `Promise<void>`

### Utility Functions

#### `getS3Config(site)`

Generate S3 configuration for a site.

**Parameters:**
- `site`: Site object

**Returns:**
- `Object`: S3 configuration with bucket, database, and table names

#### `loadSql(filename, variables, subdirectory)`

Load and process SQL template with variable substitution.

**Parameters:**
- `filename` (string): SQL template filename
- `variables` (Object): Variables for template substitution
- `subdirectory` (string): Subdirectory containing templates (default: 'weekly-analysis')

**Returns:**
- `Promise<string>`: Processed SQL query

#### `formatDateString(date)`

Format date for SQL queries.

**Parameters:**
- `date` (Date): Date to format

**Returns:**
- `string`: Formatted date string (YYYY-MM-DD)

#### `getWeekRange(offsetWeeks, referenceDate)`

Get week range based on offset from reference date.

**Parameters:**
- `offsetWeeks` (number): Number of weeks to offset (negative for past weeks)
- `referenceDate` (Date): Reference date (default: current date)

**Returns:**
- `Object`: Object with `weekStart` and `weekEnd` dates

#### `validateCountryCode(code)`

Validate and normalize country code.

**Parameters:**
- `code` (string): Country code to validate

**Returns:**
- `string`: Validated country code or 'GLOBAL' if invalid

## User Agent Patterns

Built-in patterns for filtering AI agents and bots:

- `chatgpt`: ChatGPT, GPTBot, OAI-SearchBot
- `perplexity`: Perplexity AI
- `claude`: Claude, Anthropic
- `gemini`: Google Gemini
- `copilot`: Microsoft Copilot

## Configuration

### Site Configuration

The service automatically generates S3 configuration based on the site's base URL:

```javascript
// Generated configuration example
{
  bucket: "cdn-logs-example-com",
  customerName: "example",
  customerDomain: "example_com",
  databaseName: "cdn_logs_example_com",
  tableName: "aggregated_logs_example_com",
  aggregatedLocation: "s3://cdn-logs-example-com/aggregated/",
  getAthenaTempLocation: () => "s3://cdn-logs-example-com/temp/athena-results/"
}
```

### Environment Variables

- `AWS_REGION`: AWS region for Athena queries (default: us-east-1)

## Examples

### Basic Template Execution

```javascript
import { CdnAnalyticsService } from '@adobe/spacecat-shared-cdn-analytics';

const service = new CdnAnalyticsService(context, site);

// Get bot traffic breakdown
const botTraffic = await service.executeTemplate('user-agent-weekly-breakdown', {
  whereClause: 'WHERE week_start_date >= \'2025-01-01\'',
  weekColumns: 'SUM(total_requests) as total_requests',
  orderBy: 'total_requests',
  agentFilter: 'chatgpt'
});

console.log(`Found ${botTraffic.resultCount} bot entries`);
botTraffic.results.forEach(row => {
  console.log(`${row.user_agent}: ${row.total_requests} requests`);
});
```

### Error Analysis

```javascript
// Analyze 404 errors
const errors = await service.executeTemplate('error-urls-weekly-breakdown', {
  whereClause: 'WHERE week_start_date >= \'2025-01-01\'',
  weekColumns: 'SUM(total_requests) as error_count',
  orderBy: 'error_count',
  statusFilter: '404'
});
```

### Country Traffic Analysis

```javascript
// Analyze traffic by country
const countryData = await service.executeTemplate('country-weekly-breakdown', {
  whereClause: 'WHERE week_start_date >= \'2025-01-01\'',
  weekColumns: 'SUM(total_requests) as total_requests',
  orderBy: 'total_requests',
  countryExtraction: 'UPPER(COALESCE(country_code, \'UNKNOWN\'))'
});
```

### Advanced Filtering

```javascript
// Custom WHERE clause with multiple conditions
const result = await service.executeTemplate('top-urls-weekly-breakdown', {
  whereClause: `
    WHERE week_start_date >= '2025-01-01' 
    AND status = 200 
    AND total_requests > 100
  `,
  weekColumns: 'SUM(total_requests) as total_requests, AVG(response_time) as avg_response_time',
  orderBy: 'total_requests'
});
```

## Testing

```bash
# Run tests
npm test

# Run linting
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

Apache-2.0 