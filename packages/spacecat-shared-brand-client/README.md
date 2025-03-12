# Spacecat Shared - Brand Client

A JavaScript client for the Brand API, part of the SpaceCat Shared library.
It allows you to query brand information and guidelines with in the given IMS Org.

## Installation

Install the package using npm:

```bash
npm install @adobe/spacecat-shared-brand-client
```

## Usage

### Constructor

```js
import BrandClient from '@adobe/spacecat-shared-brand-client';

const config = {
  apiKey: '<API_KEY>',
  apiBaseUrl: '<API_BASE_URL>',
};

const client = new BrandClient(config, log);
```

### Creating an instance from Helix UniversalContext

```js
const context = {
  env: {
    BRAND_API_BASE_URL: '<API_BASE_URL>',
    BRAND_API_KEY: '<API_KEY>',
  }
}; // Your Helix Universal context object
const client = BrandClient.createFrom(context);
```

### Methods

#### getBrandsForOrganization(imsOrgId, imsAccessToken)

Retrieves brands associated with an IMS organization.

```js
const brands = await client.getBrandsForOrganization('org123', 'ims-access-token');
// Returns array of Brand objects:
// [{
//   id: 'brand-id',
//   name: 'Brand Name',
//   imsOrgId: 'org123',
//   createdAt: '2024-03-01T00:00:00.000Z',
//   updatedAt: '2024-03-01T00:00:00.000Z'
// }]
```


```

#### getBrandGuidelines(brandId, imsOrgId, imsConfig)

Retrieves brand guidelines for the given brand and IMS Org.

```js
const imsConfig = {
  host: 'ims-host',
  clientId: 'client-id',
  clientCode: 'client-code',
  clientSecret: 'client-secret'
};

const guidelines = await client.getBrandGuidelines('brand123', 'org123', imsConfig);
// Returns BrandGuidelines object:
// {
//   id: 'brand123',
//   name: 'Brand Name',
//   imsOrgId: 'org123',
//   createdAt: '2024-03-01T00:00:00.000Z',
//   updatedAt: '2024-03-01T00:00:00.000Z',
//   toneOfVoice: ['friendly', 'professional'],
//   coreValues: ['innovation', 'trust'],
//   guidelines: ['Use active voice', 'Be concise'],
//   restrictions: ['Avoid jargon'],
//   additionalGuidelines: ['Additional guidelines here']
// }
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