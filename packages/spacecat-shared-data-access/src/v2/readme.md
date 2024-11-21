# ElectroDB Model Framework

This repository contains a model framework built using the ElectroDB ORM, designed to manage website improvements in a scalable manner. The system consists of several entities, including Opportunities and Suggestions, which represent potential areas of improvement and the actions to resolve them.

## Architecture Overview

The architecture is centered around a collection-management pattern with ElectroDB, enabling efficient management of DynamoDB entities. It uses a layered architecture as follows:

1. **Data Layer**: Utilizes DynamoDB as the data store, with ElectroDB for managing schema definitions and data interactions.
2. **Model Layer**: The `BaseModel` provides common methods like `save`, `remove`, and associations for all entities. Each entity (e.g., `Opportunity`, `Suggestion`) extends `BaseModel` for specific features.
3. **Collection Layer**: The `BaseCollection` handles entity-specific CRUD operations. `OpportunityCollection` and `SuggestionCollection` extend `BaseCollection` to provide tailored methods for managing Opportunities and Suggestions.
4. **Factory Layer**: The `ModelFactory` centralizes the instantiation of models and collections, providing a unified interface for interacting with different entity types.

### Architectural Diagram

```plaintext
+--------------------+
|  Data Layer        |
|--------------------|
|  DynamoDB + ElectroDB ORM  |
+--------------------+
         ↓
+--------------------+
|  Collection Layer  |
|--------------------|
|  BaseCollection,   |
|  OpportunityCollection,    |
|  SuggestionCollection      |
+--------------------+
         ↓
+--------------------+
|  Model Layer       |
|--------------------|
|  BaseModel,        |
|  Opportunity,      |
|  Suggestion        |
+--------------------+
         ↓
+--------------------+
|  Factory Layer     |
|--------------------|
|  ModelFactory      |
+--------------------+
```

## Entities and Relationships
- **Opportunity**: Represents a specific issue identified on a website. It includes attributes like `title`, `description`, `siteId`, and `status`.
- **Suggestion**: Represents a proposed fix for an Opportunity. Attributes include `opportunityId`, `type`, `status`, and `rank`.
- **Relationship**: Opportunities have many Suggestions. This is implemented through the `OpportunityCollection` and `SuggestionCollection`, which interact via ElectroDB-managed DynamoDB relationships.

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup DynamoDB**
   - This framework relies on AWS DynamoDB for data storage. Ensure you have AWS credentials configured and a DynamoDB table set up.
   - Configure the DynamoDB table name and related settings in the `index.js` configuration.

3. **Usage Example**
   ```javascript
   import { createDataAccess } from './index.js';

   const config = { tableNameData: 'YOUR_TABLE_NAME' };
   const log = console;
   const dao = createDataAccess(config, log);

   // Create a new Opportunity
   const opportunityData = { title: 'Broken Links', siteId: 'site123', type: 'broken-backlinks' };
   const newOpportunity = await dao.Opportunity.create(opportunityData);
   console.log('New Opportunity Created:', newOpportunity);
   ```

4. **Extending Functionality**
   - Add new models by extending `BaseModel` and new collections by extending `BaseCollection`.
   - Register new models in the `ModelFactory` for unified access.

## Adding a New ElectroDB-Based Entity

This guide provides a step-by-step overview for adding a new ElectroDB-based entity to the existing application. By following this guide, you will be able to create, integrate, and test a new entity seamlessly.

## Prerequisites

- Familiarity with ElectroDB and how it models data.
- Understanding of the current data model and relationships.
- Node.js and npm installed on your system.

## Step 1: Define the Entity Schema

1. **Create Entity Schema File**: Start by defining the entity schema in a new file (e.g., `myNewEntity.schema.js`) within the `/entities/` directory. This file should export a simple JavaScript object that defines the schema for the entity (refer to the existing `opportunity.schema.js` for an example).
   ```javascript
   export const MyNewEntitySchema = {
     model: {
       entity: 'MyNewEntity',
       service: 'MyService',
       version: '1',
     },
     attributes: {
       myNewEntityId: {
         type: 'string',
         required: true,
       },
       name: {
         type: 'string',
         required: true,
       },
       status: {
         type: 'string',
         enum: ['NEW', 'IN_PROGRESS', 'COMPLETED'],
         required: true,
       },
       createdAt: {
         type: 'string',
         required: true,
         default: () => new Date().toISOString(),
       },
     },
     indexes: {
       myNewEntityIndex: {
         pk: {
           field: 'pk',
           facets: ['myNewEntityId'],
         },
         sk: {
           field: 'sk',
           facets: ['status'],
         },
       },
     },
   };
   ```

## Step 2: Add a Model Class

1. **Create the Model Class**: In the `/models/` directory, add a file named `myNewEntity.model.js`.
   ```javascript
   import BaseModel from './base.model.js';

   class MyNewEntity extends BaseModel {
     constructor(electroService, modelFactory, record, log) {
       super(electroService, modelFactory, record, log);
     }

     getName() {
       return this.record.name;
     }

     setName(name) {
       this.record.name = name;
       return this;
     }

     getStatus() {
       return this.record.status;
     }

     setStatus(status) {
       this.record.status = status;
       return this;
     }
   }

   export default MyNewEntity;
   ```

## Step 3: Add a Collection Class

1. **Create the Collection Class**: Add a new file named `myNewEntity.collection.js` in the `/collections/` directory.
   ```javascript
   import BaseCollection from './base.collection.js';
   import MyNewEntity from '../models/myNewEntity.model.js';

   class MyNewEntityCollection extends BaseCollection {
     constructor(service, modelFactory, log) {
       super(service, modelFactory, MyNewEntity, log);
     }

     async allByStatus(status) {
       return await this.service.entities.myNewEntity.query.myNewEntityIndex({ status }).go();
     }
   }

   export default MyNewEntityCollection;
   ```

## Step 4: Integrate the Entity into Model Factory

1. **Update the Model Factory**: Open `model.factory.js` and add the newly created entity and collection to the initialize method.
   ```javascript
   import MyNewEntityCollection from './collections/myNewEntity.collection.js';

   class ModelFactory {
     initialize() {

       const myNewEntityCollection = new MyNewEntityCollection(
         this.service,
         this,
         this.logger,
       );

       this.models.set(MyNewEntityCollection.name, myNewEntityColection);
     }
   }
   ```

## Step 5: Write Unit Tests

1. **Create Unit Test for the Model Class**: Add a new file in the `/tests/unit/v2/models/` directory named `myNewEntity.model.test.js`.

   - Follow the existing test structure to test all getters, setters, and interactions for `MyNewEntity`.
   - Use Mocha, Chai, Chai-as-promised, and Sinon for testing.

2. **Create Unit Test for the Collection Class**: Add another test named `myNewEntity.collection.test.js`.

   - Test the methods in `MyNewEntityCollection`, particularly those interacting with ElectroDB services, such as `allByStatus`.

## Step 6: Add Guard Methods (if needed)

1. **Update Guards if Needed**: If your entity requires new types of validation, add guard methods in `guards.js`. The guards should be generic and not specific to field names—ensure they can be reused for different fields of the same type. Update `index.d.ts` to add TypeScript type definitions for those new guard functions if necessary.
   ```javascript
   export function guardStatus(propertyName, value, entityName) {
     const allowedStatuses = ['NEW', 'IN_PROGRESS', 'COMPLETED'];
     if (!allowedStatuses.includes(value)) {
       throw new Error(`${propertyName} must be one of ${allowedStatuses.join(', ')} in ${entityName}`);
     }
   }
   ```

## Step 7: Update the Patcher (if needed)

1. **Update Patcher if Needed**: Update `patcher.js` only if there are new types of data being patched that are not yet covered by the current patch methods (e.g., adding a new type like `Date` that hasn't been handled before).
   - Create methods like `patchString`, `patchEnum`, etc., only if the existing ones do not suffice for your new entity attributes.

## Step 8: Add to Integration Tests

1. **Add Integration Tests**: Update the integration test suite to include the new entity. This will help ensure that the new entity integrates well with the rest of the system. Create an integration test file named `myNewEntity.integration.test.js` in the `/tests/it/v2/` directory.
   - Test the full lifecycle of the entity: creation, updating, querying, and deletion.
   - Make sure the entity can be retrieved through various service methods and that relationships with other entities are properly maintained.

## Step 9: Create JSDoc and Update Documentation

1. **Generate JSDoc for Entity and Collection**: For each function in your model and collection files, ensure JSDoc comments are present for developers to easily understand the API.

2. **Update Type Definitions**: Update the `index.d.ts` file to include new interfaces and types for your new entity, ensuring that IDEs can provide auto-completion and type-checking.

## Step 10: Run Tests and Verify

1. **Run All Tests**: Ensure all existing and new unit tests pass using Mocha. Run:

   ```bash
   npm run test & npm run test:it
   ```

2. **Linter**: Run ESLint to check for any coding standard violations.

   ```bash
   npm run lint
   ```
