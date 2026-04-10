# Mysticat Shared - SEO Client

An SEO API client for SpaceCat services.

## Installation

```bash
npm install @adobe/mysticat-shared-seo-client
```

## Usage

### Creating an instance from Helix UniversalContext

```js
const client = SeoClient.createFrom(context);
```

### Constructor

```js
import SeoClient from '@adobe/mysticat-shared-seo-client';

const config = {
  apiKey: '<API_KEY>',
  apiBaseUrl: '<API_BASE_URL>',
};

const client = new SeoClient(config, fetch);
```

## API Methods

### `getTopPages(url, limit)`

Returns the top organic pages for a given URL prefix, sorted by traffic.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | `string` | *(required)* | A **prefix URL** scoping which pages to return. Can include protocol (e.g., `https://www.example.com`) or omit it (e.g., `www.example.com`, `example.com/us`). |
| `limit` | `number` | `200` | Maximum number of pages to return (capped at 2000). |

**Prefix URL filtering:**

The `url` parameter acts as a prefix filter, not just a plain domain. This ensures that only pages belonging to the intended hostname (and optional path prefix) are returned. For example, passing `https://www.example.com` excludes pages from subdomains like `blog.example.com` or `shop.example.com`.

- **www prefixes** (e.g., `https://www.example.com`): The method applies a server-side `Bw` (begins with) display filter on the SEMrush API call. This reliably scopes results to the correct hostname.
- **Non-www prefixes** (e.g., `https://example.com`, `example.com/us`): The `Bw` API filter is unreliable for non-www domains because it can match subdomains (e.g., a filter for `https://example.com` also matches `https://example.com.au`). To handle this, the method over-fetches (2x the requested limit) and applies client-side filtering, keeping only pages whose URL equals the prefix or starts with `{prefix}/`.
- If client-side filtering for non-www prefixes cannot meet the requested `limit`, a warning is logged (when the API returned a full result set, suggesting more pages exist but were filtered out) or a debug message is logged (when the provider simply has fewer matching pages).

**Returns:** `{ result: { pages: Array<{ url, sum_traffic, top_keyword }> }, fullAuditRef }`

**Example:**

```js
// Fetch top 100 pages for www.example.com (API-level filtering)
const { result } = await client.getTopPages('https://www.example.com', 100);

// Fetch top 50 pages for a subfolder prefix (client-side filtering)
const { result: subResult } = await client.getTopPages('example.com/us', 50);
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
