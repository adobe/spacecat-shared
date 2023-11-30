# SpaceCat Shared Data Access

This Node.js module, `spacecat-shared-data-access`, is a comprehensive data access layer for managing sites and their audits, leveraging Amazon DynamoDB. It's tailored for the `StarCatalogue` model, ensuring efficient querying and robust data manipulation.

## Installation

```bash
npm install @adobe/spacecat-shared-data-access
```

## Entities

### Sites
- **id** (String): Unique identifier for a site.
- **baseURL** (String): Base URL of the site.
- **imsOrgId** (String): Organization ID associated with the site.
- **createdAt** (String): Timestamp of creation.
- **updatedAt** (String): Timestamp of the last update.
- **GSI1PK** (String): Partition key for the Global Secondary Index.

### Audits
- **siteId** (String): Identifier of the site being audited.
- **SK** (String): Sort key, typically a composite of audit type and timestamp.
- **auditedAt** (String): Timestamp of the audit.
- **auditResult** (Map): Results of the audit.
- **auditType** (String): Type of the audit.
- **expiresAt** (Number): Expiry timestamp of the audit.
- **fullAuditRef** (String): Reference to the full audit details.

## DynamoDB Data Model

The module is designed to work with the following DynamoDB tables:

1. **Sites Table**: Manages site records.
2. **Audits Table**: Stores audit information for each site.
3. **Latest Audits Table**: Holds only the latest audit for each site for quick access.

Each table is designed with scalability and efficient querying in mind, utilizing both key and non-key attributes effectively.

For a detailed schema, refer to `docs/schema.json`. This schema is importable to Amazon NoSQL Workbench and used by the integration tests.

## Integration Testing

The module includes comprehensive integration tests embedding a local DynamoDB server with in-memory storage for testing:

```bash
npm run test:it
```

These tests create the schema, generate sample data, and test the data access patterns against the local DynamoDB instance.

## Data Access API

The module provides two main DAOs:

### Site Functions
- `getSites`
- `getSitesToAudit`
- `getSitesWithLatestAudit`
- `getSiteByBaseURL`
- `getSiteByBaseURLWithAuditInfo`
- `getSiteByBaseURLWithAudits`
- `getSiteByBaseURLWithLatestAudit`
- `addSite`
- `updateSite`

### Audit Functions
- `getAuditsForSite`
- `getAuditForSite`
- `getLatestAudits`
- `getLatestAuditForSite`
- `addAudit`

## Contributing

Contributions to `spacecat-shared-data-access` are welcome. Please adhere to the standard Git workflow and submit pull requests for proposed changes.

## License

Licensed under the Apache-2.0 License.
