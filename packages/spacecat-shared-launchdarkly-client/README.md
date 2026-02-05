# Spacecat Shared - LaunchDarkly Client

A lightweight LaunchDarkly client wrapper for checking feature flags in SpaceCat services.

## Installation

```bash
npm install @adobe/spacecat-shared-launchdarkly-client
```

## Usage

### Basic Example

```javascript
import { LaunchDarklyClient } from '@adobe/spacecat-shared-launchdarkly-client';

// Create client from Universal context
const ldClient = LaunchDarklyClient.createFrom(context);

// Check if flag is enabled for an IMS organization
const imsOrgId = '855422996904EB9F0A495F9B@AdobeOrg';
const isEnabled = await ldClient.isFlagEnabledForIMSOrg('FT_LLMO-2817', imsOrgId);

if (isEnabled) {
  // Feature is enabled for this organization
  console.log('Feature enabled');
} else {
  // Feature is disabled
  console.log('Feature disabled');
}
```

### In a Request Handler

```javascript
import { LaunchDarklyClient } from '@adobe/spacecat-shared-launchdarkly-client';

export default async function handler(request, context) {
  // Initialize client once (reuse across requests)
  const ldClient = LaunchDarklyClient.createFrom(context);
  
  // Get IMS org from request
  const imsOrgId = request.headers.get('x-ims-org-id');
  
  // Check feature flag
  const isEnabled = await ldClient.isFlagEnabledForIMSOrg(
    'FT_LLMO-2817',
    imsOrgId
  );
  
  if (isEnabled) {
    // New feature logic
    return executeNewFeature(request);
  }
  
  // Default/legacy logic
  return executeLegacyFeature(request);
}
```

### With Custom User Key (Optional)

```javascript
const ldClient = LaunchDarklyClient.createFrom(context);

// Provide a user key for tracking (defaults to 'anonymous')
const isEnabled = await ldClient.isFlagEnabledForIMSOrg(
  'FT_LLMO-2817',
  imsOrgId,
  'user-123' // optional user key for analytics
);
```

## API

### `isFlagEnabledForIMSOrg(flagKey, imsOrgId, userKey?)`

Checks if a feature flag is enabled for a specific IMS organization.

**Parameters:**
- `flagKey` (string, required) - The LaunchDarkly feature flag key
- `imsOrgId` (string, required) - The IMS organization ID (e.g., `"855422996904EB9F0A495F9A@AdobeOrg"`)
- `userKey` (string, optional) - User identifier for tracking (defaults to `"anonymous"`)

**Returns:** `Promise<boolean>` - `true` if flag is enabled, `false` otherwise

## Environment Variables

Set the following environment variable:

```bash
export LAUNCHDARKLY_SDK_KEY="sdk-your-server-side-key-here"
```

**Note:** Use a **server-side SDK key** (starts with `sdk-`), not a client-side ID.

## LaunchDarkly Configuration

In your LaunchDarkly dashboard, configure targeting rules using:
- **Attribute:** `organization identityProviderId`
- **Operator:** `is one of`
- **Values:** List of IMS org IDs

## Testing

```bash
npm test
```

## License

Apache-2.0

## Additional Information

- **Repository**: [GitHub](https://github.com/adobe/spacecat-shared)
- **Issues**: [GitHub Issues](https://github.com/adobe/spacecat-shared/issues)
- **LaunchDarkly Docs**: [Node.js SDK](https://docs.launchdarkly.com/sdk/server-side/node-js)
