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
