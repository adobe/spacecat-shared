# Dynamo Client

## Overview
This package, `@adobe/spacecat-shared-dynamo`, is a shared module designed for interacting with Amazon DynamoDB. It is a part of the Spacecat Services, providing a streamlined interface for DynamoDB operations.

## Features
- **Query Operations**: Perform read operations using primary or secondary indexes.
- **Get Item**: Retrieve single items from DynamoDB using a table name and key.
- **Put Item**: Insert or update items in DynamoDB.
- **Remove Item**: Delete items from a DynamoDB table.

## Installation
Install the package using npm:
```
npm install @adobe/spacecat-shared-dynamo
```

## Usage
First, import the `createClient` function from the package:
```javascript
import { createClient } from '@adobe/spacecat-shared-dynamo';
```
Then, use it to create a DynamoDB client:
```javascript
const dynamoClient = createClient();
```

### API Overview
- `query(params)`: Queries DynamoDB with the specified parameters.
- `getItem(tableName, key)`: Retrieves an item from a specified table using a key.
- `putItem(tableName, item)`: Inserts or updates an item in the specified table.
- `removeItem(tableName, key)`: Removes an item from the specified table.

### Example
```javascript
const tableName = 'YourTableName';
const key = { primaryKey: 'YourPrimaryKey' };

// Get an item
const item = await dynamoClient.getItem(tableName, key);

// Put an item
await dynamoClient.putItem(tableName, { primaryKey: 'NewKey', data: 'YourData' });

// Query
const queryResult = await dynamoClient.query({ TableName: tableName, KeyConditionExpression: 'primaryKey = :pk', ExpressionAttributeValues: { ':pk': 'YourPrimaryKey' } });

// Remove an item
await dynamoClient.removeItem(tableName, key);
```

## Testing
Run the included tests with the following command:
```
npm test
```

## Linting
Lint the codebase using:
```
npm run lint
```

## Cleaning
To clean the package (remove `node_modules` and `package-lock.json`):
```
npm run clean
```

## Repository
Find the source code and contribute [here](https://github.com/adobe/spacecat-shared.git).

## Issues
Report issues or bugs [here](https://github.com/adobe/spacecat-shared/issues).

## License
This project is licensed under the Apache-2.0 License.
