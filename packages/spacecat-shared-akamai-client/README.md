# Spacecat Shared - Akamai Client

## Overview

`@adobe/spacecat-shared-akamai-client` is a thin client for Akamai's
[Property Manager API (PAPI)](https://techdocs.akamai.com/property-mgr/reference/api-summary),
authenticated with Akamai's EdgeGrid (`EG1-HMAC-SHA256`) scheme. It exposes
operations for finding properties by site domain, reading and updating rule
trees, creating property versions, and activating/monitoring activations —
for use by Spacecat services that manage Akamai-fronted properties.

The EdgeGrid request signing is implemented directly against Akamai's
published algorithm (no `akamai-edgegrid` dependency), and is cross-validated
in tests against the official `edgegrid-python` reference implementation.

## Installation

```bash
npm install @adobe/spacecat-shared-akamai-client
```

## Usage

### Creating a client

#### From a Universal context (recommended)

Reads EdgeGrid credentials from `context.env`:

```javascript
import AkamaiClient from '@adobe/spacecat-shared-akamai-client';

const client = AkamaiClient.createFrom(context);
```

Expects `AKAMAI_HOST`, `AKAMAI_CLIENT_TOKEN`, `AKAMAI_CLIENT_SECRET`,
`AKAMAI_ACCESS_TOKEN`, and optionally `AKAMAI_ACCOUNT_SWITCH_KEY`.

#### Direct constructor

```javascript
import AkamaiClient from '@adobe/spacecat-shared-akamai-client';

const client = new AkamaiClient({
  host: process.env.AKAMAI_HOST, // e.g. "akab-xxxxx.luna.akamaiapis.net"
  clientToken: process.env.AKAMAI_CLIENT_TOKEN,
  clientSecret: process.env.AKAMAI_CLIENT_SECRET,
  accessToken: process.env.AKAMAI_ACCESS_TOKEN,
  accountSwitchKey: process.env.AKAMAI_ACCOUNT_SWITCH_KEY, // optional
}, log);
```

These credentials come from an Akamai API client scoped to
**Property Manager (PAPI) = READ-WRITE** — see
[Create an API client](https://techdocs.akamai.com/developer/docs/set-up-authentication-credentials).

## API

### `findPropertiesByDomain(domain)`

Finds candidate properties serving a site domain — matches the exact
hostname (plus its apex/www variant) and, as a fallback, a property-name
match. Returns matches deduped by `propertyId`, hostname matches ranked
first.

```javascript
const matches = await client.findPropertiesByDomain('www.example.com');
// [{ propertyId, propertyName, contractId, groupId, matchedOn: ['hostname'], ... }]
```

### `searchBy(key, value)`

Lower-level primitive behind `findPropertiesByDomain` — a single PAPI
find-by-value lookup.

```javascript
const results = await client.searchBy('hostname', 'www.example.com');
```

### `getLatestVersion(propertyId, contractId, groupId)`

```javascript
const version = await client.getLatestVersion(propertyId, contractId, groupId);
```

### `getRuleTree(propertyId, version, contractId, groupId)`

```javascript
const { ruleTree, ruleFormat } = await client.getRuleTree(propertyId, version, contractId, groupId);
```

### `createVersion(propertyId, baseVersion, contractId, groupId)`

Creates a new property version from `baseVersion` and returns the new
version number.

```javascript
const newVersion = await client.createVersion(propertyId, latestVersion, contractId, groupId);
```

### `updateRuleTree(propertyId, version, contractId, groupId, ruleTree, ruleFormat?)`

PUTs a rule tree with PAPI-side validation (`validateRules=true`). Errors and
warnings, if any, come back in the resolved response body rather than as a
rejected promise.

```javascript
const result = await client.updateRuleTree(propertyId, version, contractId, groupId, ruleTree, ruleFormat);
if (result.errors?.length) { /* handle PAPI validation errors */ }
```

### `activate(propertyId, version, contractId, groupId, network, notifyEmails, note?)`

```javascript
const activationLink = await client.activate(
  propertyId, version, contractId, groupId, 'STAGING', ['team@example.com'],
);
const activationId = AkamaiClient.activationIdFromLink(activationLink);
```

### `getActivation(propertyId, activationId, contractId, groupId)`

Returns one activation's details (`status`, `network`, `propertyVersion`,
`submitDate`, `updateDate`, ...). `status` progresses through
`PENDING` → `ZONE_1`/`ZONE_2`/`ZONE_3` → `ACTIVE` (or `ABORTED`/`FAILED`).

```javascript
const activation = await client.getActivation(propertyId, activationId, contractId, groupId);
```

### `listActivations(propertyId, contractId, groupId)`

All activations (both networks, all versions) for a property.

### `latestActivation(propertyId, contractId, groupId, network)`

The most recently submitted activation for a network, or `undefined` if the
property has never been activated there — useful for polling deployment
status without having to track an `activationId` across requests/sessions.

```javascript
const activation = await client.latestActivation(propertyId, contractId, groupId, 'PRODUCTION');
if (activation?.status === 'ACTIVE') { /* deployment complete */ }
```

### `normalizeDomain(domain)`

Named export. Reduces a URL, `host:port`, or trailing-dot hostname to a bare
lowercase hostname.

```javascript
import { normalizeDomain } from '@adobe/spacecat-shared-akamai-client';

normalizeDomain('HTTPS://Example.com:8080/path'); // 'example.com'
```

## Error handling

All methods reject with a descriptive `Error` when:

- a required argument is missing or the wrong type (e.g. `version` must be an
  integer, `propertyId`/`contractId`/`groupId`/`network` must be non-empty
  strings),
- the underlying request fails (network error),
- PAPI responds with a non-OK HTTP status, or
- PAPI responds with a 200 but a body that isn't valid JSON.

The error message includes the targeted path and, for non-OK responses, the
truncated response body. PAPI-level validation errors/warnings on
`updateRuleTree` (HTTP 200 with an `errors` array) are returned in the
resolved body, not thrown — check `result.errors` explicitly.

Property/version/activation IDs are URL-encoded before being interpolated
into request paths, and `searchBy`'s `key` argument is restricted to
`hostname`/`edgeHostname`/`propertyName` — both defend against a caller
accidentally (or maliciously) redirecting a request to an unintended
endpoint.

## License

Apache-2.0
