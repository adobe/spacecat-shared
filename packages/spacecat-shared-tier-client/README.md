# Spacecat Shared - Tier Client

## Overview

The TierClient library provides methods to manage entitlements and site enrollments for the Spacecat Services. This client facilitates the creation and validation of product entitlements and site enrollments for organizations and sites.

## Installation

Include the TierClient in your project by importing it from the package. Ensure that dependencies such as `@adobe/spacecat-shared-utils` and `@adobe/spacecat-shared-data-access` are also installed in your project.

```javascript
import TierClient from '@adobe/spacecat-shared-tier-client';
```

## Usage

### Creating a TierClient Instance

There are three ways to create a TierClient instance:

#### 1. Using Static Factory Methods (Recommended)

**For Organization-only operations:**
```javascript
const context = {
  dataAccess: {
    Entitlement: /* Entitlement data access object */,
    SiteEnrollment: /* SiteEnrollment data access object */,
    Organization: /* Organization data access object */,
    Site: /* Site data access object */,
    OrganizationIdentityProvider: /* OrganizationIdentityProvider data access object */,
  },
  log: {
    info: (message) => console.log(message),
    error: (message) => console.error(message),
  },
};

const organization = {
  getId: () => 'your-org-id',
};

const productCode = 'LLMO';

// Create client for organization-only operations
const orgClient = TierClient.createForOrg(context, organization, productCode);
```

**For Site-specific operations:**
```javascript
const site = {
  getId: () => 'your-site-id',
  getOrganizationId: () => 'your-org-id', // or getOrganization() method
};

// Create client for site operations
const siteClient = TierClient.createForSite(context, site, productCode);
```

#### 2. Direct Constructor Usage

```javascript
const context = {
  dataAccess: {
    Entitlement: /* Entitlement data access object */,
    SiteEnrollment: /* SiteEnrollment data access object */,
    Organization: /* Organization data access object */,
    Site: /* Site data access object */,
    OrganizationIdentityProvider: /* OrganizationIdentityProvider data access object */,
  },
  log: {
    info: (message) => console.log(message),
    error: (message) => console.error(message),
  },
};

const orgId = 'your-org-id';
const siteId = 'your-site-id'; // Optional for organization-only operations
const productCode = 'LLMO';

const tierClient = new TierClient(context, orgId, siteId, productCode);
```

### Checking Valid Entitlement

To check for valid entitlement and site enrollment, use the `checkValidEntitlement` method.

```javascript
async function checkEntitlement() {
  try {
    const result = await tierClient.checkValidEntitlement();
    
    if (result.entitlement) {
      console.log('Valid entitlement found:', result.entitlement.getId());
    }
    
    if (result.siteEnrollment) {
      console.log('Valid site enrollment found:', result.siteEnrollment.getId());
    }
    
    if (!result.entitlement) {
      console.log('No valid entitlement found');
    }
  } catch (error) {
    console.error('Error checking entitlement:', error);
  }
}

checkEntitlement();
```

### Creating Entitlement

To create a new entitlement and site enrollment, use the `createEntitlement` method.

```javascript
async function createEntitlement() {
  try {
    const tier = 'FREE_TRIAL'; // Valid tiers: FREE_TRIAL, PAID, etc.
    const result = await tierClient.createEntitlement(tier);
    
    console.log('Created entitlement:', result.entitlement.getId());
    console.log('Created site enrollment:', result.siteEnrollment.getId());
  } catch (error) {
    console.error('Error creating entitlement:', error);
  }
}

createEntitlement();
```

### `entitlement.tier_changed` event (opt-in, best-effort)

`createEntitlement` is the single choke point where an entitlement tier changes. It emits an
**`entitlement.tier_changed`** domain event on an actual transition — a fresh create
(`from: null`) or a tier change on an existing entitlement (`from: prevTier`). No event is
emitted when the tier is unchanged (or when an existing PAID entitlement is left as-is), or
when only a site enrollment is added to an existing entitlement.

Emission is **opt-in** and **best-effort**, so existing consumers are unaffected:

- It is a **no-op** unless the context provides both the shared SQS helper (`context.sqs`,
  from `sqsWrapper`) **and** an `ENTITLEMENT_EVENTS_QUEUE_URL` env var.
- A publish failure is logged and swallowed — it never fails `createEntitlement`/`save`.

```javascript
import TierClient, { ENTITLEMENT_TIER_CHANGED } from '@adobe/spacecat-shared-tier-client';

// context.sqs is provided by sqsWrapper in every SpaceCat Lambda.
const context = {
  dataAccess: { /* ... */ },
  log: { info: console.log, error: console.error, warn: console.warn },
  sqs, // shared SQS helper
  env: { ENTITLEMENT_EVENTS_QUEUE_URL: 'https://sqs.../entitlement-events' },
};
```

Payload (`EntitlementTierChangedEvent`):

```jsonc
{
  "type": "entitlement.tier_changed",
  "entitlementId": "…",
  "organizationId": "…",
  "productCode": "LLMO",
  "siteId": "…|null",
  "enrollmentId": "…|null",
  "from": "FREE_TRIAL|null",
  "to": "PAID",
  "occurredAt": "2026-07-17T00:00:00.000Z"
}
```

This is target-architecture groundwork; there is no live consumer yet (current provisioning
uses the api-service endpoint + fulfillment worker). See
[docs/adr/0002-entitlement-tier-changed-event.md](../../docs/adr/0002-entitlement-tier-changed-event.md).

## API Reference

### Static Factory Methods

#### TierClient.createForOrg(context, organization, productCode)

Creates a TierClient for organization-only operations.

**Parameters:**
- `context` (object): Context object containing dataAccess and log
- `organization` (object): Organization object with getId() method
- `productCode` (string): Product code (required)

**Returns:** TierClient instance for organization operations

#### TierClient.createForSite(context, site, productCode)

Creates a TierClient for site-specific operations.

**Parameters:**
- `context` (object): Context object containing dataAccess and log
- `site` (object): Site object with getId() method and either getOrganizationId() or getOrganization() method
- `productCode` (string): Product code (required)

**Returns:** TierClient instance for site operations

### Constructor

#### TierClient(context, orgId, siteId, productCode)

Creates a new TierClient instance directly.

**Parameters:**
- `context` (object): Context object containing dataAccess and log
- `orgId` (string): Organization ID (required)
- `siteId` (string|null|undefined): Site ID (optional for organization-only operations)
- `productCode` (string): Product code (required)

**Returns:** TierClient instance

### checkValidEntitlement()

Checks for valid entitlement on organization and valid site enrollment on site.

**Returns:** Promise<object> - Object with entitlement and/or siteEnrollment based on what exists

### createEntitlement(tier)

Creates entitlement for organization and site enrollment for site.

**Parameters:**
- `tier` (string): Entitlement tier (must be a valid tier from EntitlementModel.TIERS)

**Returns:** Promise<object> - Object with created entitlement and siteEnrollment

Emits an `entitlement.tier_changed` event on an actual tier transition (opt-in, best-effort — see [above](#entitlementtier_changed-event-opt-in-best-effort)).

## Error Handling

All methods return promises. It's important to handle errors using `try/catch` blocks in async functions to manage database errors or validation failures gracefully.

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

## Additional Informations

- **Repository**: [GitHub](https://github.com/adobe/spacecat-shared.git)
- **Issue Tracking**: [GitHub Issues](https://github.com/adobe/spacecat-shared/issues)
- **License**: Apache-2.0
