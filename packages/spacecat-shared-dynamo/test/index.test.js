/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

import { expect } from 'chai';
import { createClient } from '../src/index.js';

describe('DynamoDB Client', () => {
  let dynamoDbClient;
  let mockDocClient;

  beforeEach(() => {
    // Setup your mock DocumentClient
    mockDocClient = {
      query: async (params) => {
        // Check if LastEvaluatedKey is provided and simulate pagination
        if (params.ExclusiveStartKey === 'key2') {
          return { Items: ['item3'], LastEvaluatedKey: undefined };
        } else {
          return { Items: ['item1', 'item2'], LastEvaluatedKey: 'key2' };
        }
      },
      get: async () => ({ Item: {} }),
      put: async () => ({}),
      delete: async () => ({}),
    };

    dynamoDbClient = createClient(console, undefined, mockDocClient);
  });

  it('queries items from the database', async () => {
    const result = await dynamoDbClient.query({ TableName: 'TestTable' });
    expect(result).to.be.an('array');
  });

  it('queries items from the database with pagination', async () => {
    const result = await dynamoDbClient.query({ TableName: 'TestTable' });
    expect(result).to.have.lengthOf(3);
    expect(result).to.deep.equal(['item1', 'item2', 'item3']);
  });

  it('gets an item from the database', async () => {
    const result = await dynamoDbClient.getItem('TestTable', 'testPartitionKey');
    expect(result).to.be.an('object');
  });

  it('gets an item from the database with sort key', async () => {
    const result = await dynamoDbClient.getItem('TestTable', 'testPartitionKey', 'testSortKey');
    expect(result).to.be.an('object');
  });

  it('puts an item into the database', async () => {
    const result = await dynamoDbClient.putItem('TestTable', { someKey: 'someValue' });
    expect(result).to.deep.equal({ message: 'Item inserted/updated successfully.' });
  });

  it('removes an item from the database', async () => {
    const result = await dynamoDbClient.removeItem('TestTable', 'testPartitionKey');
    expect(result).to.deep.equal({ message: 'Item removed successfully.' });
  });

  it('removes an item from the database with sort key', async () => {
    const result = await dynamoDbClient.removeItem('TestTable', 'testPartitionKey', 'testSortKey');
    expect(result).to.deep.equal({ message: 'Item removed successfully.' });
  });

  it('handles errors in query', async () => {
    mockDocClient.query = async () => {
      throw new Error('Query failed');
    };

    try {
      await dynamoDbClient.query({ TableName: 'TestTable' });
      expect.fail('queryDb did not throw as expected');
    } catch (error) {
      expect(error.message).to.equal('Query failed');
    }
  });

  it('handles errors in getItem', async () => {
    mockDocClient.get = async () => {
      throw new Error('Get failed');
    };

    try {
      await dynamoDbClient.getItem('TestTable', 'testPartitionKey');
      expect.fail('getItem did not throw as expected');
    } catch (error) {
      expect(error.message).to.equal('Get failed');
    }
  });

  it('handles errors in putItem', async () => {
    mockDocClient.put = async () => {
      throw new Error('Put failed');
    };

    try {
      await dynamoDbClient.putItem('TestTable', { someKey: 'someValue' });
      expect.fail('putItem did not throw as expected');
    } catch (error) {
      expect(error.message).to.equal('Put failed');
    }
  });

  it('handles errors in removeItem', async () => {
    mockDocClient.delete = async () => {
      throw new Error('Remove failed');
    };

    try {
      await dynamoDbClient.removeItem('TestTable', 'testPartitionKey');
      expect.fail('removeItem did not throw as expected');
    } catch (error) {
      expect(error.message).to.equal('Remove failed');
    }
  });
});
