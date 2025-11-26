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
- `context.env.TOKOWAKA_SITE_CONFIG_BUCKET` (string): S3 bucket name for deployed configurations
- `context.env.TOKOWAKA_PREVIEW_BUCKET` (string): S3 bucket name for preview configurations
- `context.env.TOKOWAKA_CDN_PROVIDER` (string): CDN provider for cache invalidation
- `context.env.TOKOWAKA_CDN_CONFIG` (string): JSON configuration for CDN client
- `context.env.TOKOWAKA_EDGE_URL` (string): Tokowaka edge URL for preview HTML fetching

## Environment Variables

**Required:**
- `TOKOWAKA_SITE_CONFIG_BUCKET` - S3 bucket name for storing deployed configurations
- `TOKOWAKA_PREVIEW_BUCKET` - S3 bucket name for storing preview configurations

**Optional (for CDN invalidation):**
- `TOKOWAKA_CDN_PROVIDER` - CDN provider name (e.g., "cloudfront")
- `TOKOWAKA_CDN_CONFIG` - JSON string with CDN-specific configuration. (e.g., { "cloudfront": { "distributionId": <distribution-id>, "region": "us-east-1" }})

**Optional (for preview functionality):**
- `TOKOWAKA_EDGE_URL` - Tokowaka edge URL for fetching HTML content during preview
- `TOKOWAKA_PREVIEW_API_KEY` - Preview API key for authenticating with Tokowaka edge (required for preview)

### Main Methods

#### `deploySuggestions(site, opportunity, suggestions)`

Generates configuration and uploads to S3 **per URL**. **Automatically fetches existing configuration for each URL and merges** new suggestions with it. Invalidates CDN cache after upload.

**Architecture Change:** Creates one S3 file per URL instead of a single file with all URLs. This prevents files from growing too large over time.

**Returns:** `Promise<DeploymentResult>` with:
- `s3Paths` - Array of S3 keys where configs were uploaded (one per URL)
- `cdnInvalidations` - Array of CDN invalidation results (one per URL)
- `succeededSuggestions` - Array of deployed suggestions
- `failedSuggestions` - Array of `{suggestion, reason}` objects for ineligible suggestions

#### `rollbackSuggestions(site, opportunity, suggestions)`

Rolls back previously deployed suggestions by removing their patches from the configuration. **Automatically fetches existing configuration for each URL** and removes patches matching the provided suggestions. Invalidates CDN cache after upload.

**Architecture Change:** Updates one S3 file per URL instead of a single file with all URLs.

**Mapper-Specific Rollback Behavior:**
- Each opportunity mapper handles its own rollback logic via `rollbackPatches()` method
- **FAQ:** Automatically removes the "FAQs" heading patch if no FAQ suggestions remain for that URL
- **Headings/Summarization:** Simple removal by suggestion ID (default behavior)

**Returns:** `Promise<RollbackResult>` with:
- `s3Paths` - Array of S3 keys where configs were uploaded (one per URL)
- `cdnInvalidations` - Array of CDN invalidation results (one per URL)
- `succeededSuggestions` - Array of rolled back suggestions
- `failedSuggestions` - Array of `{suggestion, reason}` objects for ineligible suggestions
- `removedPatchesCount` - Total number of patches removed across all URLs

#### `previewSuggestions(site, opportunity, suggestions, options)`

Previews suggestions by uploading to preview S3 path and fetching HTML comparison. **All suggestions must belong to the same URL.**

**Returns:** `Promise<PreviewResult>` with:
- `s3Path` - S3 key where preview config was uploaded
- `config` - Preview configuration object
- `cdnInvalidation` - CDN invalidation result
- `succeededSuggestions` - Array of previewed suggestions
- `failedSuggestions` - Array of `{suggestion, reason}` objects for ineligible suggestions
- `html` - Object with `url`, `originalHtml`, and `optimizedHtml`

#### `fetchConfig(url, isPreview)`

Fetches existing Tokowaka configuration from S3 for a specific URL.

**Parameters:**
- `url` - Full URL (e.g., 'https://www.example.com/products/item')
- `isPreview` - Whether to fetch from preview path (default: false)

**Returns:** `Promise<TokowakaConfig | null>` - Configuration object or null if not found

#### `mergeConfigs(existingConfig, newConfig)`

Merges existing configuration with new configuration. For each URL path, checks if `opportunityId` + `suggestionId` combination exists and either updates or adds patches accordingly.

**Returns:** `TokowakaConfig` - Merged configuration

#### `generateConfig(url, opportunity, suggestions)`

Generates Tokowaka configuration from opportunity suggestions for a specific URL without uploading.

**Parameters:**
- `url` - Full URL for which to generate config
- `opportunity` - Opportunity entity
- `suggestions` - Array of suggestion entities

#### `uploadConfig(url, config, isPreview)`

Uploads configuration to S3 for a specific URL.

**Parameters:**
- `url` - Full URL (e.g., 'https://www.example.com/products/item')
- `config` - Tokowaka configuration object
- `isPreview` - Whether to upload to preview path (default: false)

**Returns:** `Promise<string>` - S3 key of uploaded configuration

## CDN Cache Invalidation

The client invalidates CDN cache after uploading configurations. Failures are logged but don't block deployment.

## Site Configuration

Sites must have the following configuration in their `tokowakaConfig`:

```javascript
{
  "tokowakaConfig": {
    "apiKey": "legacy-key-kept-for-backward-compatibility", // Optional, kept for backward compatibility
    "forwardedHost": "www.example.com"  // Required for preview functionality
  }
}
```

**Note:** 
- `apiKey` is optional and **not used** for S3 paths or HTTP headers (kept in schema for potential future use)
- `forwardedHost` is **required** for preview functionality to fetch HTML from Tokowaka edge

## Supported Opportunity Types

### Headings

**Deployment Eligibility:** Only suggestions with `checkType: 'heading-empty'`, `checkType: 'heading-missing-h1'` and `checkType: 'heading-h1-length'` can be deployed currently.

### FAQ

**Deployment Eligibility:** Suggestions must have `shouldOptimize: true` flag and valid FAQ item structure.

**Special Behavior:** Automatically manages heading patch - adds heading when first FAQ is deployed, removes heading when last FAQ is rolled back.

### Content Summarization

**Deployment Eligibility:** Currently all suggestions for `summarization` opportunity can be deployed.

## S3 Storage

Configurations are now stored **per URL** with domain-level metadata:

### Structure
```
s3://{TOKOWAKA_SITE_CONFIG_BUCKET}/opportunities/{normalized-domain}/
├── metadata (domain-level: siteId, prerender)
├── {base64-encoded-path-1} (URL-specific patches)
├── {base64-encoded-path-2} (URL-specific patches)
└── ...
```

For preview configurations:
```
s3://{TOKOWAKA_PREVIEW_BUCKET}/preview/opportunities/{normalized-domain}/
├── metadata
├── {base64-encoded-path-1}
└── ...
```

**Architecture Change:** Each URL has its own configuration file instead of one file per site. Domain-level metadata is stored separately to avoid duplication.

**URL Normalization:**
- Domain: Strips `www.` prefix (e.g., `www.example.com` → `example.com`)
- Path: Removes trailing slash (except for root `/`), ensures starts with `/`, then base64 URL encodes

**Example:**
- URL: `https://www.example.com/products/item`
- Metadata Path: `opportunities/example.com/metadata`
- Config Path: `opportunities/example.com/L3Byb2R1Y3RzL2l0ZW0`
- Where `L3Byb2R1Y3RzL2l0ZW0` is base64 URL encoding of `/products/item`

### Metadata File Structure
Domain-level metadata (created once per domain, shared by all URLs):
```json
{
  "siteId": "abc-123",
  "prerender": true
}
```

### Configuration File Structure
Per-URL configuration (flat structure):
```json
{
  "url": "https://example.com/products/item",
  "version": "1.0",
  "forceFail": false,
  "prerender": true,
  "patches": [
    {
      "opportunityId": "abc-123",
      "suggestionId": "xyz-789",
      "prerenderRequired": true,
      "lastUpdated": 1234567890,
      "op": "insertAfter",
      "selector": "main",
      "value": { ... },
      "valueFormat": "hast",
      "target": "ai-bots"
    }
  ]
}
```

**Note:** 
- `siteId` is stored only in domain-level `metadata`
- `prerender` is stored in both metadata (domain-level) and patch files (URL-level)
- The `baseURL` field has been renamed to `url`
- The `tokowakaOptimizations` nested structure has been removed
- The `tokowakaForceFail` field has been renamed to `forceFail`

---

## Adding Your Opportunity Type

Want to enable Tokowaka edge deployment for your opportunity type? Follow this guide to create a custom mapper.

### Overview

To enable your opportunity type to work with Tokowaka, you need to:
1. Create a mapper class that extends `BaseOpportunityMapper`
2. Implement required methods to convert your suggestions into Tokowaka patches
3. Register your mapper with the TokowakaClient
4. Test your implementation

### Step 1: Create Your Mapper

Create a new file in `src/mappers/your-opportunity-mapper.js`:

```javascript
import { BaseOpportunityMapper } from './base-opportunity-mapper.js';
import { TARGET_USER_AGENTS_CATEGORIES } from '../constants.js';

export default class YourOpportunityMapper extends BaseOpportunityMapper {
  /**
   * Returns the opportunity type this mapper handles
   * Must match the opportunity.getType() value
   */
  getOpportunityType() {
    return 'your-opportunity-type';
  }

  /**
   * Determines if prerendering is required
   * Set to true if patches modify content visible to bots/crawlers
   */
  requiresPrerender() {
    return true; // or false, depending on your use case
  }

  /**
   * Validates if a suggestion can be deployed
   * Check all required data fields and business rules
   */
  canDeploy(suggestion) {
    const data = suggestion.getData();
    
    // Example validation
    if (!data?.yourRequiredField) {
      return {
        eligible: false,
        reason: 'Missing required field: yourRequiredField',
      };
    }
    
    // Add more validation as needed
    return { eligible: true };
  }

  /**
   * Converts suggestions to Tokowaka patches
   * This is where you define what DOM modifications to make
   */
  suggestionsToPatches(urlPath, suggestions, opportunityId) {
    return suggestions.map((suggestion) => {
      const data = suggestion.getData();
      
      return {
        opportunityId,
        suggestionId: suggestion.getId(),
        prerenderRequired: this.requiresPrerender(),
        lastUpdated: Date.now(),
        
        // Define the DOM operation
        op: 'appendChild', // or 'insertAfter', 'insertBefore', 'replace'
        selector: 'main', // CSS selector for target element
        
        // The content to add/modify
        value: {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['your-class'],
          },
          children: [
            {
              type: 'text',
              value: data.yourContent,
            },
          ],
        },
        valueFormat: 'hast', // or 'text'
        
        // Who should see this modification
        target: TARGET_USER_AGENTS_CATEGORIES.AI_BOTS, // or BOTS, or ALL
      };
    });
  }
}
```

### Step 2: Understanding Patch Operations

#### Available Operations

Any valid html operations that can be performed on html elements are supported.
Below operations are already being handled as part of Headings, FAQ, and Summarization opportunities.
- **`appendChild`** - Adds content as the last child of the selector
- **`insertAfter`** - Inserts content after the selector
- **`insertBefore`** - Inserts content before the selector
- **`replace`** - Replaces the selector's content

#### Value Formats

**HAST (Hypertext Abstract Syntax Tree)** - For complex HTML:
```javascript
value: {
  type: 'element',
  tagName: 'div',
  properties: {
    className: ['my-class'],
    id: 'my-id',
  },
  children: [
    {
      type: 'element',
      tagName: 'h2',
      children: [{ type: 'text', value: 'Title' }],
    },
    {
      type: 'element',
      tagName: 'p',
      children: [{ type: 'text', value: 'Paragraph text' }],
    },
  ],
}
```

**Text** - For simple text content:
```javascript
value: 'Simple text content',
valueFormat: 'text'
```

#### Target User Agents

- **`ai-bots`** - Only AI crawlers (ChatGPT, Perplexity, etc.)
- **`bots`** - All bots including search engines
- **`all`** - Everyone (use with caution)

### Step 3: Register Your Mapper

In the TokowakaClient initialization:

```javascript
import TokowakaClient from '@adobe/spacecat-shared-tokowaka-client';
import YourOpportunityMapper from './mappers/your-opportunity-mapper.js';

// Create client
const tokowakaClient = TokowakaClient.createFrom(context);

// Register your mapper
const mapper = new YourOpportunityMapper(context.log);
tokowakaClient.registerMapper(mapper);
```

Or if you're contributing to the core package, add it to `src/mappers/mapper-registry.js`:

```javascript
import YourOpportunityMapper from './your-opportunity-mapper.js';

export default class MapperRegistry {
  constructor(log) {
    this.log = log;
    this.mappers = new Map();
    
    // Register built-in mappers
    this.registerMapper(new HeadingsMapper(log));
    this.registerMapper(new FaqMapper(log));
    this.registerMapper(new YourOpportunityMapper(log)); // Add this
  }
}
```

### Step 4: Suggestion Data Structure

Your suggestions must include a `url` field in their data:

```javascript
{
  id: 'suggestion-123',
  opportunityId: 'opportunity-456',
  data: {
    url: 'https://example.com/page',  // Required!
    yourRequiredField: 'value',
    // ... other fields specific to your opportunity
  },
  updatedAt: '2024-01-01T00:00:00Z'
}
```

### Step 5: Testing Your Mapper

Create unit tests in `test/mappers/your-opportunity-mapper.test.js`:

```javascript
import { expect } from 'chai';
import YourOpportunityMapper from '../../src/mappers/your-opportunity-mapper.js';

describe('YourOpportunityMapper', () => {
  let mapper;
  
  beforeEach(() => {
    mapper = new YourOpportunityMapper(console);
  });
  
  it('should return correct opportunity type', () => {
    expect(mapper.getOpportunityType()).to.equal('your-opportunity-type');
  });
  
  it('should validate suggestions correctly', () => {
    const validSuggestion = {
      getData: () => ({ yourRequiredField: 'value' }),
    };
    
    const result = mapper.canDeploy(validSuggestion);
    expect(result.eligible).to.be.true;
  });
  
  it('should convert suggestions to patches', () => {
    const suggestion = {
      getId: () => 'suggestion-123',
      getData: () => ({
        yourRequiredField: 'value',
        yourContent: 'Test content',
      }),
    };
    
    const patches = mapper.suggestionsToPatches(
      '/page',
      [suggestion],
      'opportunity-456'
    );
    
    expect(patches).to.have.lengthOf(1);
    expect(patches[0].suggestionId).to.equal('suggestion-123');
    expect(patches[0].op).to.equal('appendChild');
  });
});
```

### Example: FAQ Mapper

For a complete reference implementation, see `src/mappers/faq-mapper.js`:
- Handles multiple suggestions → single FAQ section
- Adds heading patch only if needed (checks existing config)
- Converts markdown to HAST format
- Implements rollback logic for grouped patches

### Best Practices

1. **Validation** - Always validate all required fields in `canDeploy()`
2. **Selectors** - Use stable, semantic selectors (avoid auto-generated classes)
3. **Prerender** - Set to `true` if content should be visible to bots
4. **Target** - Use `ai-bots` for AI-specific content, `bots` for SEO
5. **HAST** - Use HAST format for complex HTML to ensure proper structure
6. **Testing** - Write comprehensive unit tests for all mapper methods
7. **Idempotency** - Ensure patches can be safely redeployed

### Need Help?

- Check existing mappers in `src/mappers/` for examples
- Review Tokowaka patch format documentation (see Reference Material)
- Ask the SpaceCat team on Slack

---

## Reference Material

https://wiki.corp.adobe.com/display/AEMSites/Tokowaka+-+Spacecat+Integration
https://wiki.corp.adobe.com/display/AEMSites/Tokowaka+Patch+Format
