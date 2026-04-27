# SpaceCat Shared - ClickHouse Client

A ClickHouse client for SpaceCat services.

## Installation

```bash
npm install @adobe/spacecat-shared-clickhouse-client
```

## Usage

### Creating an instance from Helix UniversalContext

```js
const client = ClickhouseClient.createFrom(context);
```

### Constructor

```js
import ClickhouseClient from '@adobe/spacecat-shared-clickhouse-client';

const config = {
  host: 'https://clickhouse.example.com',
  username: 'default',
  password: '<PASSWORD>',
  database: 'default',
};

const client = new ClickhouseClient(config, console);
```

## Testing

```bash
npm run test
```

## Linting

```bash
npm run lint
```

## Additional Information

- **Repository**: [GitHub](https://github.com/adobe/spacecat-shared.git)
- **Issue Tracking**: [GitHub Issues](https://github.com/adobe/spacecat-shared/issues)
- **License**: Apache-2.0
