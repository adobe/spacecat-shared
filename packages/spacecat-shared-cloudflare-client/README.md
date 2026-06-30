# Spacecat Shared - Cloudflare Client

## Overview

`@adobe/spacecat-shared-cloudflare-client` is a thin HTTP client wrapping the
[Cloudflare API](https://developers.cloudflare.com/api/) for use by Spacecat
services. It exposes a small set of operations for managing accounts, Worker
scripts (including secrets), zones, and Worker routes.

## Installation

```bash
npm install @adobe/spacecat-shared-cloudflare-client
```

## Usage

### Creating a client

#### From a Universal context (recommended)

Reads the API token from `context.env.CLOUDFLARE_API_TOKEN`:

```javascript
import CloudflareClient from '@adobe/spacecat-shared-cloudflare-client';

const client = CloudflareClient.createFrom(context);
```

#### Direct constructor

```javascript
import CloudflareClient from '@adobe/spacecat-shared-cloudflare-client';

const client = new CloudflareClient({ token: process.env.CLOUDFLARE_API_TOKEN }, log);
```

The constructor accepts an optional `apiBase` to override the Cloudflare API
base URL (defaults to `https://api.cloudflare.com/client/v4`).

## API

### `listAccounts(options?)`

Lists Cloudflare accounts accessible with the current token. Returns a single
page of results.

```javascript
const accounts = await client.listAccounts();           // page 1, 50 per page
const more = await client.listAccounts({ page: 2, perPage: 50 });
```

> **Pagination:** `listAccounts` and `listZones` return one page at a time. To
> retrieve more than `perPage` results, call repeatedly with an incrementing
> `page`.

### `deployWorkerScript(accountId, scriptName, scriptContent, bindings?, opts?)`

Uploads a Worker script as an ES module, binding env vars and enabling
Workers Logs by default.

```javascript
await client.deployWorkerScript(
  accountId,
  'edge-optimize-router',
  scriptSource,
  [{ name: 'HOST', type: 'plain_text', text: 'example.com' }],
  { compatibilityDate: '2025-01-01', observability: true },
);
```

### `setWorkerSecret(accountId, scriptName, secretName, secretValue)`

Sets an encrypted secret on a deployed Worker script.

```javascript
await client.setWorkerSecret(accountId, 'edge-optimize-router', 'API_KEY', 's3cr3t');
```

### `listZones(options?)`

Lists active Cloudflare zones accessible with the current token. Returns a
single page of results (see pagination note above).

```javascript
const zones = await client.listZones({ page: 1, perPage: 50 });
```

### `listRoutes(zoneId)`

Lists all Worker routes for a zone.

```javascript
const routes = await client.listRoutes(zoneId);
```

### `addRoute(zoneId, pattern, scriptName)`

Adds a Worker route to a zone.

```javascript
await client.addRoute(zoneId, 'example.com/*', 'edge-optimize-router');
```

### `deleteRoute(zoneId, routeId)`

Deletes a Worker route from a zone.

```javascript
await client.deleteRoute(zoneId, routeId);
```

## Error handling

All methods reject with a descriptive `Error` when:

- a required argument is missing,
- the Cloudflare API responds with a non-OK HTTP status,
- the response body is not valid JSON, or
- the response carries `success: false`.

The error message includes the targeted path and, where available, the
Cloudflare error message or the truncated response body.

## License

Apache-2.0
