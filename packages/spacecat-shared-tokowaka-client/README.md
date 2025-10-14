# @adobe/spacecat-shared-tokowaka-client

Tokowaka Client for SpaceCat - Manages edge optimization configurations for LLM/AI agent traffic.

## Installation

```bash
npm install @adobe/spacecat-shared-tokowaka-client
```

## Usage

### Basic Usage

```javascript
import TokowakaClient from '@adobe/spacecat-shared-tokowaka-client';

// Create client from context
const tokowakaClient = TokowakaClient.createFrom(context);

// Deploy suggestions to Tokowaka
const result = await tokowakaClient.deploySuggestions(site, opportunity, suggestions);

console.log('Deployed to S3:', result.s3Key);
```

### Manual Configuration Generation

```javascript
// Generate configuration without uploading
const config = tokowakaClient.generateConfig(site, opportunity, suggestions);

console.log('Generated config:', config);
/*
{
  siteId: '9ae8877a-bbf3-407d-9adb-d6a72ce3c5e3',
  baseURL: 'https://example.com',
  version: '1.0',
  tokowakaForceFail: false,
  tokowakaOptimizations: {
    '/page1.html': {
      prerender: true,
      patches: [
        {
          op: 'replace',
          selector: 'h1.title',
          value: 'Optimized Heading',
          opportunityId: '...',
          suggestionId: '...',
          prerenderRequired: true,
          lastUpdated: 1234567890
        }
      ]
    }
  }
}
*/

// Upload config separately
const s3Key = await tokowakaClient.uploadConfig(tokowakaApiKey, config);
```

## API Reference

### TokowakaClient

#### Constructor

```javascript
new TokowakaClient(config, log)
```

**Parameters:**
- `config.bucketName` (string): S3 bucket name for storing configurations
- `config.s3Client` (S3Client): AWS S3 client instance
- `log` (Object): Logger instance (console-compatible)

#### Static Methods

##### `TokowakaClient.createFrom(context)`

Creates a client instance from a context object. Reuses existing client if available.

**Parameters:**
- `context.env.TOKOWAKA_CONFIG_BUCKET` (string): S3 bucket name
- `context.s3Client` (S3Client): AWS S3 client
- `context.log` (Object, optional): Logger instance

**Returns:** `TokowakaClient`

#### Instance Methods

##### `generateConfig(site, opportunity, suggestions)`

Generates Tokowaka configuration from opportunity suggestions.

**Parameters:**
- `site` (Object): Site entity with `getId()`, `getBaseURL()`, `getConfig()` methods
- `opportunity` (Object): Opportunity entity with `getId()`, `getType()` methods
- `suggestions` (Array): Array of suggestion entities with `getId()`, `getData()` methods

**Returns:** `TokowakaConfig` object

##### `uploadConfig(apiKey, config)`

Uploads configuration to S3.

**Parameters:**
- `apiKey` (string): Tokowaka API key (used as S3 key prefix)
- `config` (Object): Tokowaka configuration object

**Returns:** `Promise<string>` - S3 key of uploaded configuration

##### `deploySuggestions(site, opportunity, suggestions)`

Complete deployment flow: generates config and uploads to S3.

**Parameters:**
- `site` (Object): Site entity
- `opportunity` (Object): Opportunity entity
- `suggestions` (Array): Array of suggestion entities

**Returns:** `Promise<DeploymentResult>`

```typescript
interface DeploymentResult {
  tokowakaApiKey: string;
  s3Key: string;
  config: TokowakaConfig;
}
```

## Supported Opportunity Types

### 1. Headings

Optimizes heading elements (h1, h2, h3, etc.).

**Required suggestion data:**
- `recommendedAction` (or fallbacks: `value`, `suggestedText`, `text`, `heading`): New heading text
- `headingTag` (or `selector`, `cssSelector`, `xpath`): Heading tag or CSS selector (e.g., "h1", "h2")

**Example suggestion data:**
```json
{
  "url": "https://www.example.com/page.html",
  "headingTag": "h1",
  "recommendedAction": "Optimized Heading for SEO",
  "checkType": "heading-empty"
}
```

**Generated patch:**
```json
{
  "op": "replace",
  "selector": "h1",
  "value": "Optimized Heading for SEO",
  "opportunityId": "...",
  "suggestionId": "...",
  "prerenderRequired": true,
  "lastUpdated": 1234567890
}
```

### 2. Meta Tags

Updates meta tag content attributes.

**Required suggestion data:**
- `metaName` or `name`: Meta tag name attribute
- `content` or `value`: New content value

**Generated patch:**
```json
{
  "op": "replace",
  "selector": "meta[name=\"description\"]",
  "attribute": "content",
  "value": "New meta description",
  "prerenderRequired": false
}
```

### 3. Prerender

Enables pre-rendering for client-side rendered pages.

**Generated patch:**
```json
{
  "op": "prerender",
  "prerenderRequired": true
}
```

### 4. Structured Data

Adds JSON-LD structured data to pages.

**Required suggestion data:**
- `script` or `structuredData`: JSON-LD script content

**Generated patch:**
```json
{
  "op": "add",
  "selector": "head",
  "element": "script",
  "attributes": {
    "type": "application/ld+json"
  },
  "value": "{ \"@context\": \"https://schema.org\", ... }",
  "prerenderRequired": true
}
```

## Extending with Custom Mappers

The Tokowaka client uses a **Strategy Pattern** with opportunity-specific mappers. You can easily add support for new opportunity types by creating custom mappers.

### Creating a Custom Mapper

```javascript
import { BaseOpportunityMapper } from '@adobe/spacecat-shared-tokowaka-client';

class CustomOpportunityMapper extends BaseOpportunityMapper {
  getOpportunityType() {
    return 'custom-opportunity';
  }

  requiresPrerender() {
    return true; // or false, depending on your needs
  }

  suggestionToPatch(suggestion, opportunityId) {
    const data = suggestion.getData();
    
    // Validate data
    if (!this.validateSuggestionData(data)) {
      this.log.warn(`Invalid suggestion data for ${suggestion.getId()}`);
      return null;
    }
    
    // Convert suggestion data to patch format
    return {
      ...this.createBasePatch(suggestion.getId(), opportunityId),
      op: 'replace',
      selector: data.targetElement,
      value: data.newValue,
      // Add any other custom fields
    };
  }

  validateSuggestionData(data) {
    return !!(data?.targetElement && data?.newValue);
  }
}

// Register the custom mapper
const client = TokowakaClient.createFrom(context);
client.registerMapper(new CustomOpportunityMapper(context.log));

// Now the client can handle 'custom-opportunity' type
const result = await client.deploySuggestions(site, customOpportunity, suggestions);
```

### Architecture Benefits

**Common for all opportunities:**
- ✅ Authentication & Authorization
- ✅ Validation logic
- ✅ S3 upload handling
- ✅ Site config generation structure

**Opportunity-specific (via mappers):**
- 🔧 Suggestion data → Tokowaka patch conversion
- 🔧 Data field mapping
- 🔧 Prerender requirements
- 🔧 Custom validation rules

### Getting Supported Types

```javascript
const supportedTypes = client.getSupportedOpportunityTypes();
console.log(supportedTypes);
// ['headings', 'meta-tags', 'prerender', 'structured-data', 'custom-opportunity']
```

## Configuration Format

### Tokowaka Site Config

```typescript
interface TokowakaConfig {
  siteId: string;                    // Site UUID
  baseURL: string;                   // Site base URL
  version: string;                   // Config version (currently "1.0")
  tokowakaForceFail: boolean;        // Force fail flag (for testing)
  tokowakaOptimizations: {           // Optimizations by URL path
    [urlPath: string]: {
      prerender: boolean;            // Whether to pre-render this URL
      patches: TokawakaPatch[];      // Array of patches to apply
    }
  }
}
```

### Patch Format

```typescript
interface TokawakaPatch {
  op: 'replace' | 'add' | 'prerender';  // Operation type
  selector?: string;                      // CSS selector (for replace/add)
  value?: string;                         // New value
  attribute?: string;                     // Attribute to modify (optional)
  element?: string;                       // Element type to add (for 'add')
  attributes?: Record<string, string>;    // Element attributes (for 'add')
  opportunityId: string;                  // Opportunity UUID
  suggestionId: string;                   // Suggestion UUID
  prerenderRequired: boolean;             // Whether prerender is needed
  lastUpdated: number;                    // Timestamp (milliseconds)
}
```

## S3 Storage Structure

Configurations are stored at:

```
s3://{TOKOWAKA_CONFIG_BUCKET}/{tokowakaApiKey}/v1/tokowaka-site-config.json
```

**Example:**
```
s3://spacecat-tokowaka-configs/OCtrOiKqOxhg4Er3lzYDJS8FAeEUSriK/v1/tokowaka-site-config.json
```

**Cache Control:** 24 hours (86400 seconds)

## Environment Variables

```bash
TOKOWAKA_CONFIG_BUCKET=spacecat-tokowaka-configs
```

## Error Handling

The client throws errors with `status` property for HTTP-compatible error handling:

```javascript
try {
  await tokowakaClient.deploySuggestions(site, opportunity, suggestions);
} catch (error) {
  if (error.status === 400) {
    console.error('Bad request:', error.message);
  } else if (error.status === 500) {
    console.error('Server error:', error.message);
  }
}
```

## Testing

```bash
npm test
```

## License

Apache-2.0

