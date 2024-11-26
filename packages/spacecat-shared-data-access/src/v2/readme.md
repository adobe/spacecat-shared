# ElectroDB Model Framework

This repository contains a model framework built using the ElectroDB ORM, designed to manage website improvements in a scalable manner. The system consists of several entities, including Opportunities and Suggestions, which represent potential areas of improvement and the actions to resolve them.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Entities and Relationships](#entities-and-relationships)
3. [Getting Started](#getting-started)
4. [Adding a New ElectroDB-Based Entity](#adding-a-new-electrodb-based-entity)
   - [Step 1: Define the Entity Schema](#step-1-define-the-entity-schema)
   - [Step 2: Add a Model Class](#step-2-add-a-model-class)
   - [Step 3: Add a Collection Class](#step-3-add-a-collection-class)
   - [Step 4: Integrate the Entity into Model Factory](#step-4-integrate-the-entity-into-model-factory)
   - [Step 5: Write Unit and Integration Tests](#step-5-write-unit-and-integration-tests)
   - [Step 6: Create JSDoc and Update Documentation](#step-6-create-jsdoc-and-update-documentation)
   - [Step 7: Run Tests and Verify](#step-7-run-tests-and-verify)

## Architecture Overview

The architecture follows a collection-management pattern with ElectroDB, enabling efficient handling of DynamoDB entities. The architecture is organized into the following layers:

1. **Data Layer**: Uses DynamoDB with ElectroDB to manage schema definitions and data interactions.
2. **Model Layer**: The `BaseModel` provides methods like `save`, `remove`, and manages associations. Entity classes such as `Opportunity` and `Suggestion` extend `BaseModel` for specific features.
3. **Collection Layer**: The `BaseCollection` handles CRUD operations for entities. Specialized collections, like `OpportunityCollection` and `SuggestionCollection`, extend `BaseCollection` with tailored methods for specific entities.
4. **Factory Layer**: The `ModelFactory` centralizes instantiation of models and collections, providing a unified interface for different entity types.

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
- **Relationships**: Opportunities have many Suggestions. This relationship is implemented through `OpportunityCollection` and `SuggestionCollection`, which interact via ElectroDB-managed DynamoDB relationships.

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup DynamoDB**
   - Ensure AWS credentials are configured and a DynamoDB table is set up.
   - Configure the DynamoDB table name and related settings in `index.js`.

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

This guide provides a step-by-step overview for adding a new ElectroDB-based entity to the application.

### Step 1: Define the Entity Schema

1. **Create Entity Schema File**: Define the entity schema in a new file (e.g., `myNewEntity.schema.js`) within the `/schemas/` directory.

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
     references: {
       belongs_to: [
         { type: 'belongs_to', target: 'Opportunity' },
       ],
     },
   };
   ```

2. **Declare References**: Use the `references` field to define relationships between entities. This sets up associations for easy fetching and managing of related entities, allowing for automatic generation of reference getter methods.

### Step 2: Add a Model Class

1. **Create the Model Class**: In the `/models/` directory, add `myNewEntity.model.js`.

   ```javascript
   import BaseModel from './base.model.js';
   
   class MyNewEntity extends BaseModel {
     constructor(electroService, modelFactory, record, log) {
       super(electroService, modelFactory, record, log);
     }
   }
   
   export default MyNewEntity;
   ```

   Note: By using `BaseModel`, entity classes can remain empty unless there is a need to:
   - Override automatically generated getters or setters for specific attributes.
   - Add custom methods specific to the entity.

### Automatic Getter and Setter Methods

The `BaseModel` automatically generates getter and setter methods for each attribute defined in the entity schema:

- **Utility Methods**: `BaseModel` provides `getId()`, `getCreatedAt()`, and `getUpdatedAt()` methods out of the box for accessing common entity information like the unique identifier, creation timestamp, and last update timestamp.

- **Getters**: Follow the convention `get<AttributeName>()` to access attribute values.
- **Setters**: Follow the convention `set<AttributeName>(value)` to modify entity values, while handling patching.

Example:

- If an attribute is named `name`, `BaseModel` will automatically generate:
   - `getName()`: Retrieve the value of `name`.
   - `setName(value)`: Update the value of `name`.

This reduces boilerplate and ensures consistency.

### Automatic Reference Getter Methods

If references are defined in the schema (e.g., `belongs_to`, `has_many`), `BaseModel` generates reference getter methods:

- **References Getter Naming**:
   - Methods are named `get<RelatedEntity>()`, where `<RelatedEntity>` corresponds to the target specified in the `references` field.

  Example:
  ```javascript
  references: {
     belongs_to: [
        { type: 'belongs_to', target: 'Opportunity' },
     ],
  },
  ```
  This results in a `getOpportunity()` method for accessing the related `Opportunity` entity.

### Step 3: Add a Collection Class

1. **Create the Collection Class**: Add `myNewEntity.collection.js` in the `/collections/` directory.

   ```javascript
   import BaseCollection from './base.collection.js';
   import MyNewEntity from '../models/myNewEntity.model.js';

   class MyNewEntityCollection extends BaseCollection {
     constructor(service, modelFactory, log) {
       super(service, modelFactory, MyNewEntity, log);
     }

     async allByStatus(status) {
       return this.findByIndexKeys({ status });
     }
   }

   export default MyNewEntityCollection;
   ```

### Step 4: Integrate the Entity into Model Factory

1. **Update the Model Factory**: Open `model.factory.js` and add the new entity and collection to the `initialize` method.

   ```javascript
   import MyNewEntityCollection from './collections/myNewEntity.collection.js';

   class ModelFactory {
     initialize() {
       const myNewEntityCollection = new MyNewEntityCollection(
         this.service,
         this,
         this.logger,
       );

       this.models.set(MyNewEntityCollection.name, myNewEntityCollection);
     }
   }
   ```

### Step 5: Write Unit and Integration Tests

1. **Create Unit Tests**: Add a file named `myNewEntity.model.test.js` in `/tests/unit/models/` to test all getters, setters, and interactions.
   - Use Mocha, Chai, and Sinon for testing.

2. **Create Collection Tests**: Add `myNewEntity.collection.test.js` to `/tests/unit/collections/`.
   - Test methods interacting with ElectroDB, like `allByStatus`.

3. **Add Integration Tests**: Create an integration test file named `myNewEntity.integration.test.js` in `/tests/integration/` to test the full lifecycle of the entity.

### Step 6: Create JSDoc and Update Documentation

1. **Generate JSDoc for Entity and Collection**: Add JSDoc comments for each function to describe the API.
2. **Update Type Definitions**: Modify `index.d.ts` to include new interfaces and types for the entity.

### Step 7: Run Tests and Verify

1. **Run All Tests**:
   ```bash
   npm run test && npm run test:it
   ```

2. **Run Linter**: Check for coding standard violations.
   ```bash
   npm run lint
   ```
