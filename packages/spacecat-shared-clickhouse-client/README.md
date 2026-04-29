# SpaceCat Shared - ClickHouse Client

ClickHouse client for SpaceCat services. Provides batch writes with per-row validation, querying, and data transformation for brand presence tables.

## Installation

```bash
npm install @adobe/spacecat-shared-clickhouse-client
```

## Usage

```js
import ClickhouseClient, { toBrandPresenceExecution } from '@adobe/spacecat-shared-clickhouse-client';

const client = new ClickhouseClient({
  url: 'https://clickhouse.example.com',
  username: 'default',
  password: '<PASSWORD>',
  database: 'default',
});

// Write rows (validates each row before insert)
const { written, failures } = await client.writeBatch('brand_presence_executions', rows);

// Query
const results = await client.query('SELECT * FROM brand_presence_executions WHERE site_id = {siteId:String}', { siteId });

await client.close();
```

Connection parameters can also be set via environment variables:

| Variable | Purpose |
|---|---|
| `CLICKHOUSE_URL` | ClickHouse HTTP endpoint |
| `CLICKHOUSE_USER` | Username |
| `CLICKHOUSE_PASSWORD` | Password |
| `CLICKHOUSE_DB` | Database name |

## Testing

### Unit tests

```bash
npm test
```

### Integration tests

Requires Docker.

```bash
npm run test:it
```

Starts a local ClickHouse container via `docker-compose.test.yml`, runs the tests, and stops the container afterwards. No additional setup needed.

## Linting

```bash
npm run lint
```

## Additional Information

- **Repository**: [GitHub](https://github.com/adobe/spacecat-shared.git)
- **Issue Tracking**: [GitHub Issues](https://github.com/adobe/spacecat-shared/issues)
- **License**: Apache-2.0
