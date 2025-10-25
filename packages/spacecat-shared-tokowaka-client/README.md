# @adobe/spacecat-shared-tokowaka-client

Tokowaka Client for SpaceCat - Manages edge optimization configurations for LLM/AI agent traffic.

## Installation

```bash
npm install @adobe/spacecat-shared-tokowaka-client
```

## Usage

```javascript
import TokowakaClient from '@adobe/spacecat-shared-tokowaka-client';

const tokowakaClient = TokowakaClient.createFrom(context);
const result = await tokowakaClient.deploySuggestions(site, opportunity, suggestions);
```

## API Reference

### TokowakaClient.createFrom(context)

Creates a client instance from a context object.

**Required context properties:**
- `context.s3.s3Client` (S3Client): AWS S3 client instance
- `context.log` (Object, optional): Logger instance
- `context.env.TOKOWAKA_SITE_CONFIG_BUCKET` (string): S3 bucket name for configurations
- `context.env.TOKOWAKA_CDN_PROVIDER` (string): CDN provider for cache invalidation
- `context.env.TOKOWAKA_CDN_CONFIG` (string): JSON configuration for CDN client

## Environment Variables

**Required:**
- `TOKOWAKA_SITE_CONFIG_BUCKET` - S3 bucket name for storing configurations

**Optional (for CDN invalidation):**
- `TOKOWAKA_CDN_PROVIDER` - CDN provider name (e.g., "cloudfront")
- `TOKOWAKA_CDN_CONFIG` - JSON string with CDN-specific configuration. (e.g., { "cloudfront": { "distributionId": <distribution-id>, "region": "us-east-1" }})

### Main Methods

#### `deploySuggestions(site, opportunity, suggestions)`

Generates configuration and uploads to S3. **Automatically fetches existing configuration and merges** new suggestions with it. Invalidates CDN cache after upload.

**Returns:** `Promise<DeploymentResult>` with:
- `s3Path` - S3 key where config was uploaded
- `cdnInvalidation` - CDN invalidation result (or error)
- `succeededSuggestions` - Array of deployed suggestions
- `failedSuggestions` - Array of `{suggestion, reason}` objects for ineligible suggestions

#### `fetchConfig(apiKey)`

Fetches existing Tokowaka configuration from S3.

**Returns:** `Promise<TokowakaConfig | null>` - Configuration object or null if not found

#### `mergeConfigs(existingConfig, newConfig)`

Merges existing configuration with new configuration. For each URL path, checks if `opportunityId` + `suggestionId` combination exists and either updates or adds patches accordingly.

**Returns:** `TokowakaConfig` - Merged configuration

#### `generateConfig(site, opportunity, suggestions)`

Generates Tokowaka configuration from opportunity suggestions without uploading.

#### `uploadConfig(apiKey, config)`

Uploads configuration to S3. Returns S3 key of uploaded configuration.

## CDN Cache Invalidation

The client invalidates CDN cache after uploading configurations. Failures are logged but don't block deployment.

## Supported Opportunity Types

### Headings
Optimizes heading elements. Requires `recommendedAction` (new text) and `headingTag` (e.g., "h1", "h2").

**Deployment Eligibility:** Only suggestions with `checkType: 'heading-empty'` can be deployed currently. Other heading types (e.g., `heading-missing`) are filtered out during deployment.

## Extending with Custom Mappers

You can add support for new opportunity types by extending `BaseOpportunityMapper`:

```javascript
import { BaseOpportunityMapper } from '@adobe/spacecat-shared-tokowaka-client';

class CustomOpportunityMapper extends BaseOpportunityMapper {
  getOpportunityType() {
    return 'custom-opportunity';
  }

  requiresPrerender() {
    return true;
  }

  suggestionToPatch(suggestion, opportunityId) {
    const data = suggestion.getData();
    if (!this.validateSuggestionData(data)) {
      return null;
    }
    
    return {
      ...this.createBasePatch(suggestion.getId(), opportunityId),
      op: 'replace',
      selector: data.targetElement,
      value: data.newValue,
    };
  }

  validateSuggestionData(data) {
    return !!(data?.targetElement && data?.newValue);
  }
}

// Register the mapper
const client = TokowakaClient.createFrom(context);
client.registerMapper(new CustomOpportunityMapper(context.log));
```

## Configuration Format

### Tokowaka Config

```typescript
interface TokowakaConfig {
  siteId: string;
  baseURL: string;
  version: string;
  tokowakaForceFail: boolean;
  tokowakaOptimizations: {
    "prerender": true,
    [urlPath: string]: {
      prerender: boolean;
      patches: TokawakaPatch[];
    }
  }
}

interface TokawakaPatch {
  op: 'replace' | 'add' | 'prerender';
  selector?: string;
  value?: string;
  attribute?: string;
  element?: string;
  attributes?: Record<string, string>;
  opportunityId: string;
  suggestionId: string;
  prerenderRequired: boolean;
  lastUpdated: number;
}
```

## S3 Storage

Configurations are stored at:
```
s3://{TOKOWAKA_SITE_CONFIG_BUCKET}/opportunities/{tokowakaApiKey}
```

**Note:** The configuration is stored as a JSON file containing the complete Tokowaka optimization config for the site.


