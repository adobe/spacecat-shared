# Spacecat Shared - Splunk Client

A JavaScript client for the Splunk API, part of the SpaceCat Shared library. It allows you to query Splunk for useful patterns in CDN logs worth flagging to customers, including error pages delivered with a 200 status code which are a content request reduction (and therefore cost savings) opportunity.

The Splunk API requires first authenticating (see https://docs.splunk.com/Documentation/Splunk/9.4.0/RESTREF/RESTaccess#auth.2Flogin) then issuing a query using a session ID and cookie from the authentication response (see https://docs.splunk.com/Documentation/Splunk/9.4.0/RESTREF/RESTsearch#search.2Fjobs).

The corporate Splunk instance requires corporate network connectivity.  Additional configuration is required for the service to work.  The unit tests can run locally without being on the corporate network.

## Installation

Install the package using npm:

```bash
npm install @adobe/spacecat-shared-splunk-client
```

## Usage

### Constructor

```js
import SplunkAPIClient, { fetch } from '@adobe/spacecat-shared-splunk-client';

const config = {
  apiBaseUrl: 'SPLUNK_API_BASE_URL',
  apiUser: 'SPLUNK_API_USER',
  apiPass: 'SPLUNK_API_PASS',
};

const client = new SplunkAPIClient(config, fetch);
```

### Creating and instance from Helix UniversalContext

```js
const context = {}; // Your AWS Lambda context object
const client = SplunkAPIClient.createFrom(context);
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