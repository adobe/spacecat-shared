# Spacecat Shared - MacGiver Client

A thin client over the MacGiver FACS `/api/facs/permissions/check` endpoint for
evaluating a single user's permissions within an IMS organization. Consumed by
`spacecat-auth-service` at login to mint the `facs_permissions` JWT claim.

## Installation

```bash
npm install @adobe/spacecat-shared-mac-giver-client
```

## Usage

### Create from a Universal context

The wrapper attaches the client to `context.macGiverClient` (place it after the
IMS client wrapper, since it requires `context.imsClient`):

```javascript
import { macGiverClientWrapper } from '@adobe/spacecat-shared-mac-giver-client';

export const main = wrap(run)
  .with(macGiverClientWrapper);
```

Or construct directly:

```javascript
import { MacGiverClient } from '@adobe/spacecat-shared-mac-giver-client';

const client = MacGiverClient.createFrom(context);
```

### Check an explicit list of permissions

Returns the subset of the requested permissions that are allowed:

```javascript
const allowed = await client.checkListOfPermission({
  userId: '17837D23...@AdobeID',
  imsOrgId: 'AAAA...CCCC@AdobeOrg',
  permissions: ['llmo/can_view', 'llmo/can_manage_users'],
});
// → ['llmo/can_view']
```

### Check all permissions in a namespace

Evaluates every permission defined in the given namespaces and returns the
allowed subset:

```javascript
const allowed = await client.checkAllPermission({
  userId: '17837D23...@AdobeID',
  imsOrgId: 'AAAA...CCCC@AdobeOrg',
  namespaces: ['llmo'],
});
// → ['llmo/can_view', 'llmo/can_manage_users']
```

## Behavior

- **Evaluated, none granted** — a `2xx` `SUCCESS` response with no `allowed: true`
  entries (or a non-`SUCCESS` status) returns `[]`.
- **Could not evaluate** — a non-`2xx` response or transport failure **throws**
  (with a `tag: 'macgiver'` warning), so callers can fail-safe (e.g. omit the
  `facs_permissions` claim) rather than confusing an outage with "no permissions".
- The request is bounded by `AbortSignal.timeout` (default `5000` ms, tunable via
  the `MACGIVER_TIMEOUT_MS` env var) since MacGiver sits on the login critical path.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `MACGIVER_BASE_URL` | `http://localhost:8080` | MacGiver service base URL. |
| `MACGIVER_TIMEOUT_MS` | `5000` | Per-request timeout in milliseconds. |
