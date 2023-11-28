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

describe('removeItem', () => {
  let dynamoDbClient;
  let mockDocClient;

  beforeEach(() => {
    mockDocClient = {
      delete: async () => ({}),
    };

    dynamoDbClient = createClient(console, undefined, mockDocClient);
  });

  it('removes an item from the database', async () => {
    const key = { partitionKey: 'testPartitionKey' };
    const result = await dynamoDbClient.removeItem('TestTable', key);
    expect(result).to.deep.equal({ message: 'Item removed successfully.' });
  });

  it('removes an item from the database with sort key', async () => {
    const key = { partitionKey: 'testPartitionKey', sortKey: 'testSortKey' };
    const result = await dynamoDbClient.removeItem('TestTable', key);
    expect(result).to.deep.equal({ message: 'Item removed successfully.' });
  });

  it('throws an error for removeItem with invalid tableName', async () => {
    const key = { partitionKey: 'testPartitionKey' };
    try {
      await dynamoDbClient.removeItem('', key);
      expect.fail('removeItem did not throw with empty tableName');
    } catch (error) {
      expect(error.message).to.equal('Invalid tableName: must be a non-empty string.');
    }
  });

  it('throws an error for removeItem with invalid key', async () => {
    try {
      await dynamoDbClient.removeItem('TestTable', null);
      expect.fail('removeItem did not throw with invalid key');
    } catch (error) {
      expect(error.message).to.equal('Invalid key: must be an object with a partitionKey.');
    }
  });

  it('handles errors in removeItem', async () => {
    mockDocClient.delete = async () => {
      throw new Error('Remove failed');
    };

    try {
      await dynamoDbClient.removeItem('TestTable', { partitionKey: 'testPartitionKey' });
      expect.fail('removeItem did not throw as expected');
    } catch (error) {
      expect(error.message).to.equal('Remove failed');
    }
  });
});
