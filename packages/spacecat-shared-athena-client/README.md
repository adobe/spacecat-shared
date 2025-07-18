# @adobe/spacecat-shared-athena-client

This package provides a shared AWS Athena client for Spacecat Services.

## Installation

```bash
npm install @adobe/spacecat-shared-athena-client
```

## Usage

```javascript
import { AWSAthenaClient } from '@adobe/spacecat-shared-athena-client';
import { AthenaClient } from '@aws-sdk/client-athena';

// Create a client directly
const client = new AthenaClient({ region: 'us-east-1' });
const athenaClient = new AWSAthenaClient(client, 's3://your-temp-bucket/', console);

// Or create from context
const context = {
  env: { AWS_REGION: 'us-east-1' },
  log: console
};
const athenaClient = AWSAthenaClient.fromContext(context, 's3://your-temp-bucket/');

// Execute a query and get results
const results = await athenaClient.query(
  'SELECT * FROM your_table',
  'your_database',
  'Example query'
);

// Execute a DDL operation without results
const queryId = await athenaClient.execute(
  'CREATE TABLE your_table ...',
  'your_database',
  'Create table'
);
```

## Configuration Options

The client accepts the following options:

- `backoffMs` (default: 100) - Base backoff time in milliseconds for retries
- `maxRetries` (default: 3) - Maximum number of retry attempts
- `pollIntervalMs` (default: 1000) - Interval between query status checks
- `maxPollAttempts` (default: 120) - Maximum number of status check attempts

## API

### `constructor(client, tempLocation, log, opts?)`

Creates a new Athena client instance.

- `client`: AWS Athena SDK client instance
- `tempLocation`: S3 URI for temporary query results
- `log`: Logger object with info/warn/error/debug methods
- `opts`: Optional configuration options

### `static fromContext(context, tempLocation, opts?)`

Creates a client from a context object.

- `context`: Object containing env.AWS_REGION and log
- `tempLocation`: S3 URI for temporary query results
- `opts`: Optional configuration options

### `query(sql, database, description?, opts?)`

Executes a query and returns parsed results.

- `sql`: SQL query string
- `database`: Target database name
- `description`: Optional query description for logs
- `opts`: Optional execution options
- Returns: Promise<Array> of parsed results

### `execute(sql, database, description?, opts?)`

Executes a query without returning results (for DDL operations).

- `sql`: SQL query string
- `database`: Target database name
- `description`: Optional query description for logs
- `opts`: Optional execution options
- Returns: Promise<string> query execution ID

## Contributing

Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

## Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE.txt) for more information. 