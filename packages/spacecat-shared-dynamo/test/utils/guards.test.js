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
import { guardKey, guardQueryParameters, guardTableName } from '../../src/utils/guards.js';

describe('Query Parameter Guards', () => {
  describe('guardTableName', () => {
    it('throws an error if tableName is empty', () => {
      expect(() => guardTableName('')).to.throw('Table name is required.');
    });

    it('does not throw an error for valid tableName', () => {
      expect(() => guardTableName('validTableName')).to.not.throw();
    });
  });

  describe('guardKey', () => {
    it('throws an error if key is not an object', () => {
      expect(() => guardKey('notAnObject')).to.throw('Key must be a non-empty object.');
    });

    it('throws an error if key is an empty object', () => {
      expect(() => guardKey({})).to.throw('Key must be a non-empty object.');
    });

    it('does not throw an error for a valid key with one property', () => {
      expect(() => guardKey({ somePartitionKeyField: 'value' })).to.not.throw();
    });

    it('does not throw an error for a valid key with two properties', () => {
      expect(() => guardKey({ somePartitionKeyField: 'value', someOptionalRangeKey: 'anotherValue' })).to.not.throw();
    });
  });

  describe('guardQueryParameters', () => {
    it('throws an error if params is not an object', () => {
      expect(() => guardQueryParameters('notAnObject')).to.throw('Query parameters must be an object.');
    });

    it('throws an error if any required parameter is missing', () => {
      expect(() => guardQueryParameters({ TableName: 'table' })).to.throw('Query parameters is missing required parameter: KeyConditionExpression');
    });

    it('does not throw an error for valid params', () => {
      const validParams = {
        TableName: 'table',
        KeyConditionExpression: 'expression',
        ExpressionAttributeValues: {},
      };
      expect(() => guardQueryParameters(validParams)).to.not.throw();
    });
  });
});
