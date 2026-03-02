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

## Supported Opportunity Types

### Headings

**Deployment Eligibility:** Only suggestions with `checkType: 'heading-empty'`, `checkType: 'heading-missing-h1'` and `checkType: 'heading-h1-length'` can be deployed currently.

### FAQ

**Deployment Eligibility:** Suggestions must have `shouldOptimize: true` flag and valid FAQ item structure.

**Special Behavior:** Automatically manages heading patch - adds heading when first FAQ is deployed, removes heading when last FAQ is rolled back.

### Content Summarization

**Deployment Eligibility:** Currently all suggestions for `summarization` opportunity can be deployed.
