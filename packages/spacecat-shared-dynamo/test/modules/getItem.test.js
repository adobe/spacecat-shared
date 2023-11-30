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

import { expect } from 'chai';
import { createClient } from '../../src/index.js';

describe('getItem', () => {
  let dynamoDbClient;
  let mockDocClient;

  beforeEach(() => {
    mockDocClient = {
      get: async () => ({ Item: {} }),
    };

    dynamoDbClient = createClient(console, undefined, mockDocClient);
  });

  it('gets an item from the database', async () => {
    const key = { partitionKey: 'testPartitionKey' };
    const result = await dynamoDbClient.getItem('TestTable', null, key);
    expect(result).to.be.an('object');
  });

  it('gets an item from the database with sort key', async () => {
    const key = { partitionKey: 'testPartitionKey', sortKey: 'testSortKey' };
    const result = await dynamoDbClient.getItem('TestTable', null, key);
    expect(result).to.be.an('object');
  });

  it('gets an item from the database with index', async () => {
    const key = { partitionKey: 'testPartitionKey', sortKey: 'testSortKey' };
    const result = await dynamoDbClient.getItem('TestTable', 'test-index', key);
    expect(result).to.be.an('object');
  });

  it('throws an error for getItem with invalid tableName', async () => {
    const key = { partitionKey: 'testPartitionKey' };
    try {
      await dynamoDbClient.getItem('', key);
      expect.fail('getItem did not throw with empty tableName');
    } catch (error) {
      expect(error.message).to.equal('Table name is required.');
    }
  });

  it('throws an error for getItem with invalid key', async () => {
    try {
      await dynamoDbClient.getItem('TestTable', null, null);
      expect.fail('getItem did not throw with invalid key');
    } catch (error) {
      expect(error.message).to.equal('Key must be a non-empty object.');
    }
  });

  it('handles errors in getItem', async () => {
    mockDocClient.get = async () => {
      throw new Error('Get failed');
    };

    try {
      await dynamoDbClient.getItem('TestTable', null, { partitionKey: 'testPartitionKey' });
      expect.fail('getItem did not throw as expected');
    } catch (error) {
      expect(error.message).to.equal('Get failed');
    }
  });
});
