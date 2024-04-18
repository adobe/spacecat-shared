# Spacecat Shared - Ahrefs Client

A JavaScript client for the Ahrefs API v3, part of the SpaceCat Shared library.
It allows you to query the Ahrefs API for top pages, backlinks, organic traffic data, and more.

## Installation

Install the package using npm:

```bash
npm install @adobe/spacecat-shared-ahrefs-client
```

## Usage

### Constructor

```js
import AhrefsAPIClient, { fetch } from '../src/index.js';

const config = {
  apiKey: '<API_KEY>',
  apiBaseUrl: '<API_BASE_URL>',
};

const client = new AhrefsAPIClient(config, fetch);
```

### Creating and instance from Helix UniversalContext

```js
const context = {}; // Your AWS Lambda context object
const client = AhrefsAPIClient.createFrom(context);
```

## Testing

To run tests:

```bash
npm run test
```

## Linting

Lint your code:

```bash
npm run lint
```

## Cleaning

To remove `node_modules` and `package-lock.json`:

```bash
npm run clean
```

## Additional Information

- **Repository**: [GitHub](https://github.com/adobe/spacecat-shared.git)
- **Issue Tracking**: [GitHub Issues](https://github.com/adobe/spacecat-shared/issues)
- **License**: Apache-2.0
