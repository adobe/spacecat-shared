# Spacecat Shared - ADobe Analytics API Client

A JavaScript client for Adobe Analytics API, part of the SpaceCat Shared library.

## Installation

Install the package using npm:

```bash
npm install @adobe/spacecat-shared-aa-api-client
```

## Usage

### Creating and instance from Helix UniversalContext

```js
const context = {}; // Your AWS Lambda context object
const aaApiClient = AAAPIClient.create(context);

```

### Constructor

`AAAPIClient` class needs AA API domain key to be instantiated:

```js
const domainKey = "your-domain-key";
const aaApiClient = new AAAPIClient(domainKey);
```

### Creating a AA Backlink

```js
const url = "https://example.com";
const expiryInDays = 7;

const backlink = await aaApiClient.createRUMBacklink(url, expiryInDays);
console.log(`Backlink created: ${backlink}`)
```

### Creating a 404 Report Backlink

```js
const url = "https://example.com";
const expiryInDays = 7;

const backlink = await aaApiClient.create404Backlink(url, expiryInDays);
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
Find the source code and contribute [here](https://github.com/adobe/spacecat-shared.git).

## Issues
Report issues or bugs [here](https://github.com/adobe/spacecat-shared/issues).

## License
This project is licensed under the Apache-2.0 License.
