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

## Additional Information

- **Repository**: [GitHub](https://github.com/adobe/spacecat-shared.git)
- **Issue Tracking**: [GitHub Issues](https://github.com/adobe/spacecat-shared/issues)
- **License**: Apache-2.0
