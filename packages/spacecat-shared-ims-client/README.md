# Spacecat Shared - IMS Client

## Overview

The ImsClient library is designed to interact with the IMS (Identity Management System) API, facilitating the retrieval of organization details, user information, and service access tokens. This document outlines the necessary steps for setting up the environment and provides usage examples for integrating the ImsClient into your projects.

## Environment Setup

Before using the ImsClient, ensure your environment is correctly configured with the necessary credentials and endpoints. The following environment variables are required:

- `IMS_HOST`: The hostname of the IMS API.
- `IMS_CLIENT_ID`: Your IMS client ID.
- `IMS_CLIENT_CODE`: Your IMS client code, used for authentication.
- `IMS_CLIENT_SECRET`: Your IMS client secret, used for authentication.

## Installation

Include the ImsClient in your project by importing it from its source file. Ensure that dependencies such as `@adobe/fetch` and `@adobe/spacecat-shared-utils` are also installed in your project.

```javascript
import ImsClient from 'path/to/ImsClient';
```

## Usage

### Creating an ImsClient Instance

To create an instance of the ImsClient, you need to provide a context object containing the necessary environment configurations and an optional log.

```javascript
const context = {
  env: {
    IMS_HOST: 'ims.example.com',
    IMS_CLIENT_ID: 'yourClientId',
    IMS_CLIENT_CODE: 'yourClientCode',
    IMS_CLIENT_SECRET: 'yourClientSecret',
  },
  log: console, // Optional: Custom log can be provided
};

const imsClient = ImsClient.createFrom(context);
```

### Retrieving Service Access Token

To fetch a service access token, use the `getServiceAccessToken` method. This token is required for authenticating subsequent API requests.

```javascript
async function fetchServiceAccessToken() {
  try {
    const token = await imsClient.getServiceAccessToken();
    console.log('Service Access Token:', token);
  } catch (error) {
    console.error('Error fetching service access token:', error);
  }
}

fetchServiceAccessToken();
```

### Getting IMS Organization Details

Retrieve details about an IMS organization by its ID using the `getImsOrganizationDetails` method.

```javascript
async function fetchImsOrganizationDetails(imsOrgId) {
  try {
    const details = await imsClient.getImsOrganizationDetails(imsOrgId);
    console.log('Organization Details:', details);
  } catch (error) {
    console.error('Error fetching organization details:', error);
  }
}

const imsOrgId = 'yourImsOrgId';
fetchImsOrganizationDetails(imsOrgId);
```

## Error Handling

All methods return promises. It's important to handle errors using `try/catch` blocks in async functions to manage API request failures or invalid responses gracefully.

## Promise Tokens Across Long-Running Jobs

`ImsPromiseClient` mints and exchanges IMS promise tokens for on-behalf-of (OBO) auth
carried through a queue (SQS message, etc.) to a downstream worker. The exchanged
access token is short-lived (~5 min), and each exchange rolls the promise token
forward to a new one with its own expiry — but `ImsPromiseClient.exchangeToken` does
not persist that rolled token for you. A worker whose job outlives one access token's
TTL needs it to exchange again later in the same job.

`PromiseTokenSession` wraps a CONSUMER-type `ImsPromiseClient` to do exactly that:

```javascript
import { ImsPromiseClient, createPromiseTokenSession } from '@adobe/spacecat-shared-ims-client';

const consumerClient = ImsPromiseClient.createFrom(context, ImsPromiseClient.CLIENT_TYPE.CONSUMER);

// `initialPromiseToken` is whatever was carried through the queue message.
const session = createPromiseTokenSession(consumerClient, initialPromiseToken, {
  enableEncryption: Boolean(context.env.AUTOFIX_CRYPT_SECRET && context.env.AUTOFIX_CRYPT_SALT),
});

try {
  const accessToken = await session.exchange();
  // ... do work with accessToken ...

  if (session.isExpired()) {
    // re-exchange before the next use, if the job is still running
    await session.exchange();
  }
} catch (error) {
  if (error.code === 'NEEDS_REAUTH') {
    // terminal — the user must re-authenticate; there is no retry that helps here.
  }
  throw error;
} finally {
  await session.invalidate();
}
```

- `exchange()` returns the current access token and transparently persists the
  rolled promise token for the next call.
- `isExpired()` / `getRemainingMs()` report on the *promise* token's rolled expiry,
  not the access token's — check this before a retry loop's next attempt if the job
  can run long enough to matter.
- On a 401/403 from IMS (the promise token can no longer be exchanged), `exchange()`
  throws `NeedsReauthError` (`error.code === 'NEEDS_REAUTH'`) instead of a generic
  error, so callers can distinguish "needs the user to re-authenticate" from a
  transient failure worth retrying.
- `invalidate()` is idempotent and safe to call in a `finally` block regardless of
  how the job ended.
- The session is in-memory and scoped to one process/invocation — it is not meant to
  be persisted across separate Lambda invocations.

## Development

### Testing

To run tests:

```bash
npm test
```

### Linting

Lint your code:

```bash
npm run lint
```

### Cleaning

To remove `node_modules` and `package-lock.json`:

```bash
npm run clean
```

## Additional Information

- **Repository**: [GitHub](https://github.com/adobe/spacecat-shared.git)
- **Issue Tracking**: [GitHub Issues](https://github.com/adobe/spacecat-shared/issues)
- **License**: Apache-2.0
  
