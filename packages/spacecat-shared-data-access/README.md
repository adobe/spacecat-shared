# SpaceCat Shared Data Access

This Node.js module, `spacecat-shared-data-access`, is a data access layer for managing sites and their audits, leveraging Amazon DynamoDB.

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

### SiteCandidates
- **baseURL** (String): Base URL of the site candidate.
- **status** (String): Status of the site candidate (PENDING, IGNORED, APPROVED, ERROR).
- **createdAt** (String): Timestamp of creation.
- **updatedAt** (String): Timestamp of the last update.
- **updatedBy** (String): Slack id of the last person updated the site candidate.

### Audits
- **siteId** (String): Identifier of the site being audited.
- **SK** (String): Sort key, typically a composite of audit type and timestamp.
- **auditedAt** (String): Timestamp of the audit.
- **auditResult** (Map): Results of the audit.
- **auditType** (String): Type of the audit.
- **expiresAt** (Number): Expiry timestamp of the audit.
- **fullAuditRef** (String): Reference to the full audit details.

### SiteTopPages
- **siteId** (String): Identifier of the site.
- **url** (String): URL of the top page.
- **traffic** (Number): Traffic of the top page.
- **source** (String): Source of the data.
- **geo** (String): Geo of the top page.
- **importedAt** (String): Timestamp of the import.

### Organization
- **id** (String): Unique identifier for an organization.
- **createdAt** (String): Timestamp of creation.
- **updatedAt** (String): Timestamp of the last update.

### OrganizationIdentityProvider
- **id** (String): Unique identifier for the identity provider.
- **metadata** (Map): Metadata for the identity provider.
- **provider** (String): Type of identity provider. (IMS, MICROSOFT, GOOGLE)
- **externalId** (String): External identifier from the provider.
- **createdAt** (String): Timestamp of creation.

### TrialUser
- **id** (String): Unique identifier for the trial user.
- **externalUserId** (String): External user identifier.
- **status** (String): Status of the trial user. (REGISTERED, VERIFIED, BLOCKED, DELETED)
- **provider** (String): Type of identity provider. (IMS, MICROSOFT, GOOGLE)
- **lastSeenAt** (String): Timestamp of last activity.
- **createdAt** (String): Timestamp of creation.
- **metadata** (Map): Metadata for the trial user.
- **updatedAt** (String): Timestamp of the last update.

### TrialUserActivity
- **id** (String): Unique identifier for the trial user activity.
- **type** (String): Type of activity performed. (SIGN_UP, SIGN_IN, CREATE_SITE, RUN_AUDIT, PROMPT_RUN, DOWNLOAD)
- **details** (Map): Details of the activity.
- **createdAt** (String): Timestamp of creation.
- **productCode** (String): Product code associated with the activity. (LLMO, ASO, etc.)

### Entitlement
- **id** (String): Unique identifier for the entitlement.
- **productCode** (String): Product code for the entitlement. (LLMO, ASO, etc.)
- **tier** (String): Tier level of the entitlement. (FREE_TRIAL, PAID)
- **status** (String): Status of the entitlement. (ACTIVE, SUSPENDED, ENDED)
- **createdAt** (String): Timestamp of creation.
- **updatedAt** (String): Timestamp of the last update.
- **quotas** (Map): Quota information for the entitlement.

### SiteEnrollment
- **id** (String): Unique identifier for the site enrollment.
- **status** (String): Status of the enrollment. (ACTIVE, SUSPENDED, ENDED)
- **createdAt** (String): Timestamp of creation.

### FixEntity
- **fixEntityId** (String): Unique identifier for the fix entity.
- **opportunityId** (String): ID of the associated opportunity.
- **createdAt** (String): Timestamp of creation.
- **updatedAt** (String): Timestamp of the last update.
- **type** (String): Type of the fix entity (from Suggestion.TYPES).
- **status** (String): Status of the fix entity (PENDING, DEPLOYED, PUBLISHED, FAILED, ROLLED_BACK).
- **executedBy** (String): Who executed the fix.
- **executedAt** (String): When the fix was executed.
- **publishedAt** (String): When the fix was published.
- **changeDetails** (Object): Details of the changes made.

### Suggestion
- **suggestionId** (String): Unique identifier for the suggestion.
- **opportunityId** (String): ID of the associated opportunity.
- **createdAt** (String): Timestamp of creation.
- **updatedAt** (String): Timestamp of the last update.
- **status** (String): Status of the suggestion (NEW, APPROVED, IN_PROGRESS, SKIPPED, FIXED, ERROR, OUTDATED).
- **type** (String): Type of the suggestion (CODE_CHANGE, CONTENT_UPDATE, REDIRECT_UPDATE, METADATA_UPDATE, AI_INSIGHTS, CONFIG_UPDATE).
- **rank** (Number): Rank/priority of the suggestion.
- **data** (Object): Data payload for the suggestion.
- **kpiDeltas** (Object): KPI delta information (optional).

### FixEntitySuggestion
- **suggestionId** (String): ID of the associated suggestion (primary partition key).
- **fixEntityId** (String): ID of the associated fix entity (primary sort key).
- **opportunityId** (String): ID of the associated opportunity.
- **fixEntityCreatedAt** (String): Creation timestamp of the fix entity.
- **fixEntityCreatedDate** (String): Date portion of fixEntityCreatedAt (auto-generated).
- **createdAt** (String): Timestamp of creation.
- **updatedAt** (String): Timestamp of the last update.

## DynamoDB Data Model

The module is designed to work with the following DynamoDB tables:

1. **Sites Table**: Manages site records.
2. **Audits Table**: Stores audit information for each site.
3. **Latest Audits Table**: Holds only the latest audit for each site for quick access.
4. **Site Candidates Table**: Manages site candidates.
5. **Site Top Pages Table**: Stores top pages for each site.

Each table is designed with scalability and efficient querying in mind, utilizing both key and non-key attributes effectively.

For a detailed schema, refer to `docs/schema.json`. This schema is importable to Amazon NoSQL Workbench and used by the integration tests.

## Integration Testing

The module includes comprehensive integration tests embedding a local DynamoDB server with in-memory storage for testing:

```bash
npm run test:it
```

These tests create the schema, generate sample data, and test the data access patterns against the local DynamoDB instance.

## Data Access API

The module provides the following DAOs:

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
- `removeSite`
- `findByPreviewURL`
- `findByExternalOwnerIdAndExternalSiteId`

### Site Candidate Functions
- `getSiteCandidateByBaseURL`
- `upsertSiteCandidate`
- `siteCandidateExists`
- `updateSiteCandidate`

### Audit Functions
- `getAuditsForSite`
- `getAuditForSite`
- `getLatestAudits`
- `getLatestAuditForSite`
- `addAudit`

### Site Top Pages Functions
- `getTopPagesForSite`
- `addSiteTopPage`

### FixEntity Functions
- `getSuggestionsByFixEntityId` - Gets all suggestions associated with a specific FixEntity
- `setSuggestionsForFixEntity` - Sets suggestions for a FixEntity by managing junction table relationships

### Suggestion Functions
- `bulkUpdateStatus` - Updates the status of multiple suggestions in bulk
- `getFixEntitiesBySuggestionId` - Gets all FixEntities associated with a specific Suggestion

### FixEntitySuggestion Functions
- `allBySuggestionId` - Gets all junction records associated with a specific Suggestion
- `allByFixEntityId` - Gets all junction records associated with a specific FixEntity

## Integrating Data Access in AWS Lambda Functions

Our `spacecat-shared-data-access` module includes a wrapper that can be easily integrated into AWS Lambda functions using `@adobe/helix-shared-wrap`.
This integration allows your Lambda functions to access and manipulate data.

### Steps for Integration

1. **Import the Data Access Wrapper**

   Along with other wrappers and utilities, import the `dataAccessWrapper`.

   ```javascript
   import dataAccessWrapper from '@adobe/spacecat-shared-data-access';
   ```

2. **Provide Required Environment Variables**

   The `dataAccessWrapper` requires the `DYNAMO_TABLE_NAME_DATA` environment variable to be set via AWS
   secret assigned to your Lambda function.

   ```javascript
   const { DYNAMO_TABLE_NAME_DATA } = context.env;
   ```

3. **Modify Your Lambda Wrapper Script**

   Include `dataAccessWrapper` in the chain of wrappers when defining your Lambda handler.

   ```javascript
   export const main = wrap(run)
     .with(sqsEventAdapter)
     .with(dataAccessWrapper) // Add this line
     .with(sqs)
     .with(secrets)
     .with(helixStatus);
   ```

4. **Access Data in Your Lambda Function**

   Use the `dataAccess` object from the context to interact with your data layer.

   ```javascript
   async function run(message, context) {
     const { dataAccess } = context;
     
     // Example: Retrieve all sites
     const sites = await dataAccess.Site.getSites();
     // ... more logic ...
   }
   ```

### Example

Here's a complete example of a Lambda function utilizing the data access wrapper:

```javascript
import wrap from '@adobe/helix-shared-wrap';
import dataAccessWrapper from '@adobe/spacecat-shared-data-access';
import sqsEventAdapter from './sqsEventAdapter';
import sqs from './sqs';
import secrets from '@adobe/helix-shared-secrets';
import helixStatus from '@adobe/helix-status';

async function run(message, context) {
  const { dataAccess } = context;
  try {
    const sites = await dataAccess.Site.getSites();
    // Function logic here
  } catch (error) {
    // Error handling
  }
}

export const main = wrap(run)
  .with(sqsEventAdapter)
  .with(dataAccessWrapper)
  .with(sqs)
  .with(secrets)
  .with(helixStatus);
```

## Contributing

Contributions to `spacecat-shared-data-access` are welcome. Please adhere to the standard Git workflow and submit pull requests for proposed changes.

## Local Development and Testing

### Testing with Dependent Projects Before Merging

When making changes to this package, you can test them in dependent projects (like `spacecat-api-service`) before merging using the following approach:

1. Commit and push your changes to a branch in this repository
2. Get the commit ID of your push
3. In your dependent project, temporarily modify the package.json dependency:

   ```json
   // From:
   "@adobe/spacecat-shared-data-access": "2.13.1",
   
   // To:
   "@adobe/spacecat-shared-data-access": "https://gitpkg.now.sh/adobe/spacecat-shared/packages/spacecat-shared-data-access?YOUR_COMMIT_ID",
   ```

4. Run `npm install` in your dependent project
5. Test your changes
6. Once testing is complete and your PR is merged, update the dependent project to use the released version

## License

Licensed under the Apache-2.0 License.
