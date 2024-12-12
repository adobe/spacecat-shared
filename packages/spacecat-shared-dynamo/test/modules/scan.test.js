/*
 * Copyright 2024 Adobe. All rights reserved.
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

describe('scan', () => {
  const scanParams = {
    TableName: 'TestTable',
  };
  const scanParamsWithLimit = {
    TableName: 'TestTable',
    Limit: 1,
  };

  let dynamoDbClient;
  let mockDocClient;

  beforeEach(() => {
    mockDocClient = {
      scan: async (params) => {
        if (params.Limit) {
          return { Items: ['item1'] };
        }
        // Check if LastEvaluatedKey is provided and simulate pagination
        if (params.ExclusiveStartKey === 'key2') {
          return { Items: ['item3'], LastEvaluatedKey: undefined };
        } else {
          return { Items: ['item1', 'item2'], LastEvaluatedKey: 'key2' };
        }
      },
    };

    dynamoDbClient = createClient(console, undefined, mockDocClient);
  });

  it('scans items from the database', async () => {
    const result = await dynamoDbClient.scan(scanParams);
    expect(result).to.be.an('array');
  });

  it('scans items from the database with pagination', async () => {
    const result = await dynamoDbClient.scan(scanParams);
    expect(result).to.have.lengthOf(3);
    expect(result).to.deep.equal(['item1', 'item2', 'item3']);
  });

  it('scans items from the database with limit', async () => {
    const result = await dynamoDbClient.scan(scanParamsWithLimit);
    expect(result).to.have.lengthOf(1);
    expect(result).to.deep.equal(['item1']);
  });

  it('handles errors in scan', async () => {
    mockDocClient.scan = async () => {
      throw new Error('Scan failed');
    };

    try {
      await dynamoDbClient.scan(scanParams);
      expect.fail('scanDb did not throw as expected');
    } catch (error) {
      expect(error.message).to.equal('Scan failed');
    }
  });
});
