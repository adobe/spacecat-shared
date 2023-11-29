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

describe('putItem', () => {
  let dynamoDbClient;
  let mockDocClient;

  beforeEach(() => {
    mockDocClient = {
      put: async () => ({}),
    };

    dynamoDbClient = createClient(console, undefined, mockDocClient);
  });

  it('puts an item into the database', async () => {
    const result = await dynamoDbClient.putItem('TestTable', { someKey: 'someValue' });
    expect(result).to.deep.equal({ message: 'Item inserted/updated successfully.' });
  });

  it('throws an error for putItem with invalid tableName', async () => {
    try {
      await dynamoDbClient.putItem('', { someKey: 'someValue' });
      expect.fail('putItem did not throw with empty tableName');
    } catch (error) {
      expect(error.message).to.equal('Table name is required.');
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
});
