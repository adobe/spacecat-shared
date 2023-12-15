# Spacecat Shared - RUM API Client

A JavaScript client for Adobe's Real User Monitoring (RUM) API, part of the SpaceCat Shared library.

## Installation

Install the package using npm:

```bash
npm install @adobe/spacecat-shared-rum-api-client
```

## Usage

### Creating and instance from Helix UniversalContext

```js
const context = {}; // Your AWS Lambda context object
const rumApiClient = RUMAPIClient.createFrom(context);

```

### Constructor

`RUMAPIClient` class needs RUM API domain key to be instantiated:

```js
const domainKey = "your-domain-key";
const rumApiClient = new RUMAPIClient(domainKey);
```

### Creating a RUM Backlink

```js
const url = "https://example.com";
const expiry = 7; // in days

const backlink = await rumApiClient.createRUMBacklink(url, expiry);
console.log(`Backlink created: ${backlink}`)
```

### Creating a 404 Report Backlink

```js
const url = "https://example.com";
const expiry = 7; // in days

const backlink = await rumApiClient.create404Backlink(url, expiry);
console.log(`Backlink created: ${backlink}`)
```

### Getting RUM Dashboard Data

```js
const url = "example.com";

const rumData = await rumApiClient.getRUMDashboard({ url });
console.log(`RUM data: ${rumData}`)
```

### Getting 404 checkpoints

```js
const url = "example.com";

const backlink = await rumApiClient.get404Sources({ url });
console.log(`404 Checkpoints: ${backlink}`)
```

### Getting Edge Delivery Services Domains

```js
const url = "all";

const domains = await rumApiClient.getDomainList({}, url);
console.log(`Backlink created: ${backlink}`)
```

## Testing
Run the included tests with the following command:
```
npm test
```

## Linting
Lint the codebase using:
```
npm run lint
```

## Cleaning
To clean the package (remove `node_modules` and `package-lock.json`):
```
npm run clean
```

## Repository
Find the source code and contribute [here](https://github.com/adobe-rnd/spacecat-shared.git).

## Issues
Report issues or bugs [here](https://github.com/adobe-rnd/spacecat-shared/issues).

## License
This project is licensed under the Apache-2.0 License.
