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

#### `rollbackSuggestions(site, opportunity, suggestions)`

Rolls back previously deployed suggestions by removing their patches from the configuration. **Automatically fetches existing configuration** and removes patches matching the provided suggestions. Invalidates CDN cache after upload.

**Mapper-Specific Rollback Behavior:**
- Each opportunity mapper handles its own rollback logic via `rollbackPatches()` method
- **FAQ:** Automatically removes the "FAQs" heading patch if no FAQ suggestions remain for that URL
- **Headings/Summarization:** Simple removal by suggestion ID (default behavior)

**Returns:** `Promise<RollbackResult>` with:
- `s3Path` - S3 key where config was uploaded
- `cdnInvalidation` - CDN invalidation result (or error)
- `succeededSuggestions` - Array of rolled back suggestions
- `failedSuggestions` - Array of `{suggestion, reason}` objects for ineligible suggestions
- `removedPatchesCount` - Number of patches removed from the configuration

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

**Deployment Eligibility:** Only suggestions with `checkType: 'heading-empty'`, `checkType: 'heading-missing-h1'` and `checkType: 'heading-h1-length'` can be deployed currently.

### Content Summarization

**Deployment Eligibility:**  Currently all suggestions for `summarization` opportunity can be deployed.

## S3 Storage

Configurations are stored at:
```
s3://{TOKOWAKA_SITE_CONFIG_BUCKET}/opportunities/{tokowakaApiKey}
```

**Note:** The configuration is stored as a JSON file containing the complete Tokowaka optimization config for the site.


## Extending Rollback Behavior

To customize rollback logic for a new opportunity type, override the `rollbackPatches()` method in your mapper:

```javascript
class CustomMapper extends BaseOpportunityMapper {
  rollbackPatches(config, suggestionIds, opportunityId) {
    // Custom rollback logic here
    // Example: Remove additional resources, cleanup shared state, etc.
    
    // Call base implementation or use custom logic
    return removePatchesBySuggestionIds(config, suggestionIds, additionalPatchKeys);
  }
}
```

The default implementation in `BaseOpportunityMapper` simply removes patches by suggestion IDs. Override this method if your opportunity type needs special cleanup (like FAQ's heading removal).

## Reference Material

https://wiki.corp.adobe.com/display/AEMSites/Tokowaka+-+Spacecat+Integration
https://wiki.corp.adobe.com/display/AEMSites/Tokowaka+Patch+Format
