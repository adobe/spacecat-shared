# ElectroDB Entity Schemas

Generated on: 2025-09-23T05:00:03.371Z
Total Entities: 27

## Many-to-Many Relationship Implementation

This schema includes the implementation of a many-to-many relationship between `FixEntity` and `Suggestion` entities through the `FixEntitySuggestion` junction table.

### Key Changes:
- **FixEntity**: Now connects to Suggestions via FixEntitySuggestion junction table
- **Suggestion**: Now connects to FixEntities via FixEntitySuggestion junction table  
- **FixEntitySuggestion**: New junction entity enabling many-to-many relationships

### Relationship Flow:
```
FixEntity ←→ FixEntitySuggestion ←→ Suggestion
```

## Entity List

- `apiKey`
- `asyncJob`
- `audit`
- `configuration`
- `entitlement`
- `experiment`
- `fixEntity`
- `fixEntitySuggestion`
- `importJob`
- `importUrl`
- `keyEvent`
- `latestAudit`
- `opportunity`
- `organization`
- `organizationIdentityProvider`
- `pageIntent`
- `report`
- `scrapeJob`
- `scrapeUrl`
- `site`
- `siteCandidate`
- `siteEnrollment`
- `siteTopForm`
- `siteTopPage`
- `suggestion`
- `trialUser`
- `trialUserActivity`

## Schema Details

See the complete schemas in `electrodb-schemas.json`.
