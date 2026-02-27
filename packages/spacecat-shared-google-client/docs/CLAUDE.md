# CLAUDE.md - Google Client Documentation

This document provides guidance for Claude Code, Cursor, and other AI assistants working with the `@adobe/spacecat-shared-google-client` package.

## Overview

The Google Client is a shared module for Spacecat Services that provides authenticated access to Google Search Console (GSC) APIs. It handles OAuth2 authentication, token refresh, and provides methods for querying search analytics data, inspecting URLs, and listing sites.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GoogleClient                              │
├─────────────────────────────────────────────────────────────────┤
│  Static Factory Method                                           │
│  └── createFrom(context, baseURL)                               │
│      ├── Loads customer tokens from AWS Secrets Manager          │
│      ├── Detects LLMO vs default client via x-client-type header│
│      └── Returns configured GoogleClient instance                │
├─────────────────────────────────────────────────────────────────┤
│  Instance Methods                                                │
│  ├── getOrganicSearchData() - Query GSC Search Analytics        │
│  ├── urlInspect()           - Inspect URL indexing status       │
│  └── listSites()            - List verified GSC sites           │
├─────────────────────────────────────────────────────────────────┤
│  Internal                                                        │
│  └── #refreshTokenIfExpired() - Auto-refresh OAuth tokens       │
└─────────────────────────────────────────────────────────────────┘
```

## Environment Variables

### Default Google OAuth Client

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | Yes | OAuth callback URL (e.g., `https://spacecat.experiencecloud.live/api/v1/auth/google/callback`) |

### LLMO-Specific Google OAuth Client

When requests come from the LLMO UI (identified by `x-client-type: llm-optimizer-ui` header), the client uses separate OAuth credentials:

| Variable | Required | Description |
|----------|----------|-------------|
| `LLMO_CLIENT_TYPE` | No | Header value to match (default: `llm-optimizer-ui`) |
| `LLMO_GOOGLE_CLIENT_ID` | Yes* | Google OAuth Client ID for LLMO |
| `LLMO_GOOGLE_CLIENT_SECRET` | Yes* | Google OAuth Client Secret for LLMO |
| `LLMO_GOOGLE_REDIRECT_URI` | Yes* | OAuth callback URL for LLMO (e.g., `https://llmo.experiencecloud.live/api/v1/auth/google/callback`) |

*Required when serving LLMO UI requests

### Why Separate Clients?

The LLMO UI (`llmo.experiencecloud.live`) and Sites Optimizer UI (`spacecat.experiencecloud.live`) need separate Google OAuth clients because:
1. Google OAuth requires exact redirect URI matching
2. Each domain has a different callback URL
3. Allows independent credential rotation and management

## Customer Token Storage

Customer OAuth tokens (obtained after user completes Google OAuth flow) are stored in AWS Secrets Manager. The secret path is resolved using `resolveCustomerSecretsName(baseURL, context)` from `@adobe/spacecat-shared-utils`.

### Secret Structure

```json
{
  "access_token": "ya29.xxx...",
  "refresh_token": "1//xxx...",
  "token_type": "Bearer",
  "expiry_date": 1234567890000,
  "site_url": "https://example.com/"
}
```

The `site_url` can be either:
- A standard URL: `https://example.com/`
- A domain property: `sc-domain:example.com`

## Usage Examples

### Basic Usage

```javascript
import GoogleClient from '@adobe/spacecat-shared-google-client';

// In a controller/handler with context
async function handler(context) {
  const baseURL = 'https://example.com';

  // Create client (auto-detects LLMO vs default based on headers)
  const googleClient = await GoogleClient.createFrom(context, baseURL);

  // Query search analytics
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-01-31');
  const data = await googleClient.getOrganicSearchData(startDate, endDate);

  return data;
}
```

### Get Organic Search Data with Options

```javascript
const data = await googleClient.getOrganicSearchData(
  startDate,
  endDate,
  ['date', 'query', 'page'],  // dimensions
  500,                         // rowLimit (1-1000)
  0                            // startRow
);
```

### Inspect URL Indexing Status

```javascript
const inspectionResult = await googleClient.urlInspect('https://example.com/page');
// Returns: { inspectionResult: { indexStatusResult: {...}, ... } }
```

### List Verified Sites

```javascript
const sites = await googleClient.listSites();
// Returns: { siteEntry: [{ siteUrl: '...', permissionLevel: '...' }, ...] }
```

## Client Type Detection

The `createFrom` method automatically detects which OAuth client to use:

```javascript
// From src/index.js lines 76-79
const clientType = context.pathInfo?.headers?.['x-client-type'];
const llmoClientType = context.env.LLMO_CLIENT_TYPE || 'llm-optimizer-ui';
const isLlmoClient = clientType === llmoClientType;
```

The `x-client-type` header is set by the frontend:
- LLMO UI sets: `x-client-type: llm-optimizer-ui`
- Sites Optimizer UI sets: `x-client-type: sites-optimizer-ui`

## Error Handling

All methods throw descriptive errors:

```javascript
try {
  const client = await GoogleClient.createFrom(context, baseURL);
} catch (error) {
  // Possible errors:
  // - "Error creating GoogleClient: Invalid base URL"
  // - "Error creating GoogleClient: Secrets Manager error"
  // - "Error creating GoogleClient: Token refresh failed"
}

try {
  const data = await client.getOrganicSearchData(startDate, endDate);
} catch (error) {
  // Possible errors:
  // - "Error retrieving organic search data from Google API: Invalid site URL in secret (...)"
  // - "Error retrieving organic search data from Google API: Invalid date format"
  // - "Error retrieving organic search data from Google API: Row limit must be between 1 and 1000"
}
```

## Token Refresh

The client automatically refreshes expired OAuth tokens before making API calls. This happens transparently in the `#refreshTokenIfExpired()` private method.

## Dependencies

| Package | Purpose |
|---------|---------|
| `googleapis` | Google APIs Node.js client |
| `google-auth-library` | OAuth2 authentication |
| `@aws-sdk/client-secrets-manager` | Retrieve customer tokens |
| `@adobe/spacecat-shared-utils` | Utilities (URL validation, secret name resolution) |

## Testing

```bash
# Run tests with coverage
npm test

# Run linting
npm run lint
```

Tests are located in `test/index.test.js` and use:
- `mocha` - Test runner
- `chai` - Assertions
- `sinon` - Mocking/stubbing
- `nock` - HTTP mocking

## File Structure

```
packages/spacecat-shared-google-client/
├── src/
│   ├── index.js      # Main GoogleClient class
│   └── utils.js      # HTTP fetch utility
├── test/
│   ├── index.test.js # Unit tests
│   └── setup-env.js  # Test environment setup
├── docs/
│   └── CLAUDE.md     # This documentation
└── package.json
```

## Common Tasks

### Adding a New API Method

1. Add the method to `src/index.js`
2. Call `await this.#refreshTokenIfExpired()` at the start
3. Use `this.authClient` for authenticated requests
4. Add corresponding tests in `test/index.test.js`
5. Ensure 100% code coverage

### Adding a New Client Type

To support a third client type (e.g., a new UI):

1. Add new env vars: `NEWUI_GOOGLE_CLIENT_ID`, etc.
2. Modify the client detection logic in `createFrom`:

```javascript
const clientType = context.pathInfo?.headers?.['x-client-type'];
const llmoClientType = context.env.LLMO_CLIENT_TYPE || 'llm-optimizer-ui';
const newuiClientType = context.env.NEWUI_CLIENT_TYPE || 'new-ui';

let clientId, clientSecret, redirectUri;
if (clientType === llmoClientType) {
  clientId = context.env.LLMO_GOOGLE_CLIENT_ID;
  // ...
} else if (clientType === newuiClientType) {
  clientId = context.env.NEWUI_GOOGLE_CLIENT_ID;
  // ...
} else {
  clientId = context.env.GOOGLE_CLIENT_ID;
  // ...
}
```

3. Add tests for the new client type
4. Update this documentation

## Related Services

- **spacecat-api-service**: Main API that uses this client for GSC operations
- **llmo-data-retrieval-service**: Uses GSC data for prompt generation
- **project-elmo-ui**: LLMO frontend that triggers GSC authentication

## OAuth Flow Overview

1. User clicks "Connect to Google Search Console" in UI
2. UI redirects to `/auth/google/{siteId}`
3. Backend redirects to Google OAuth consent screen
4. User grants access
5. Google redirects to callback URL with auth code
6. Backend exchanges code for tokens
7. Tokens stored in AWS Secrets Manager
8. GoogleClient can now be created for this site
