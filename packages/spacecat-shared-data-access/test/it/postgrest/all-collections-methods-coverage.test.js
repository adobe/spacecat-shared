/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { expect } from 'chai';

import { createITDataAccess, TEST_IDS, TEST_VALUES } from './helpers.js';

const GENERIC_UUID = '11111111-1111-4111-8111-111111111111';
const GENERIC_URL = 'https://it.example.com';

const getMethodNames = (collection) => {
  const names = new Set();

  let proto = collection;
  while (proto && proto !== Object.prototype) {
    Object.getOwnPropertyNames(proto).forEach((name) => {
      if (name === 'constructor' || name.startsWith('_')) {
        return;
      }

      if (typeof collection[name] === 'function') {
        names.add(name);
      }
    });

    proto = Object.getPrototypeOf(proto);
  }

  Object.getOwnPropertyNames(collection).forEach((name) => {
    if (name.startsWith('_')) {
      return;
    }

    if (typeof collection[name] === 'function') {
      names.add(name);
    }
  });

  return [...names]
    .filter((name) => name !== 'clazz')
    .sort();
};

const KEY_EVENT_DEPRECATED_METHODS = new Set([
  'all',
  'allByIndexKeys',
  'findById',
  'findByIndexKeys',
  'create',
  'createMany',
  'removeByIds',
  'removeByIndexKeys',
]);

const MUTATING_METHOD_PREFIXES = ['create', 'update', 'remove', 'set', 'bulk'];
const MUTATING_METHODS = new Set([
  'applyUpdateWatchers',
  '_saveMany',
]);

const EXPECTED_MUTATION_ERROR_PATTERNS = [
  'deprecated in data-access v3',
  'cannot be created directly',
  'not supported',
  'required',
  'invalid',
  'must be',
  'not found',
  'Failed to create',
  'Failed to update',
  'Failed to remove',
];

const isMutatingMethod = (methodName) => MUTATING_METHOD_PREFIXES
  .some((prefix) => methodName.startsWith(prefix))
  || MUTATING_METHODS.has(methodName);

const isExpectedMutationError = (error) => {
  const message = error?.message || '';
  return EXPECTED_MUTATION_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

const getArgsForMethod = (entityName, methodName) => {
  switch (methodName) {
    case 'all':
      return [{}, { limit: 1 }];
    case 'allByIndexKeys':
      return [{}, { limit: 1 }];
    case 'findByAll':
      return [{}, { limit: 1 }];
    case 'findByIndexKeys':
      return [{}, { limit: 1 }];
    case 'findById': {
      if (entityName === 'LatestAudit') {
        return [TEST_IDS.siteId, '404'];
      }
      if (entityName === 'AuditUrl') {
        return [TEST_IDS.siteId, GENERIC_URL];
      }
      if (entityName === 'SentimentGuideline' || entityName === 'SentimentTopic') {
        return [TEST_IDS.siteId, GENERIC_UUID];
      }
      return [GENERIC_UUID];
    }
    case 'existsById':
      return [GENERIC_UUID];
    case 'batchGetByKeys':
      return [[{ id: GENERIC_UUID }]];
    case 'create':
      return [{}];
    case 'createMany':
      return [[{}]];
    case 'updateByKeys':
      return [{ id: GENERIC_UUID }, {}];
    case 'removeByIds':
      return [[GENERIC_UUID]];
    case 'removeByIndexKeys':
      return [[{ id: GENERIC_UUID }]];
    case 'allByDateRange':
      return ['2025-01-01', '2025-02-01'];
    case 'allRecentByUrlAndProcessingType':
      return [GENERIC_URL, 'default', 24];
    case 'findByPreviewURL':
      return [TEST_VALUES.csPreviewURL];
    case 'allWithLatestAudit':
      return ['404', 'desc'];
    case 'allByProjectName':
      return [TEST_VALUES.projectName];
    case 'allByOrganizationIdAndProjectId':
      return [TEST_IDS.organizationId, TEST_IDS.projectId];
    case 'allByOrganizationIdAndProjectName':
      return [TEST_IDS.organizationId, TEST_VALUES.projectName];
    case 'allByAuditType':
      return ['404'];
    case 'findBySiteIdAndUrl':
      return [TEST_IDS.siteId, GENERIC_URL];
    case 'allBySiteIdAndAuditType':
      return [TEST_IDS.siteId, '404', { limit: 1 }];
    case 'allBySiteIdSorted':
      return [TEST_IDS.siteId, { limit: 1 }];
    case 'allBySiteIdByCustomerSorted':
      return [TEST_IDS.siteId, true, { limit: 1 }];
    case 'removeForSiteId':
      return [TEST_IDS.siteId];
    case 'removeForSiteIdByCustomer':
      return [TEST_IDS.siteId, true];
    case 'removeByUrlAndFormSource':
      return [GENERIC_URL, ''];
    case 'findByUrlAndFormSource':
      return [GENERIC_URL, ''];
    case 'getSuggestionsByFixEntityId':
      return [GENERIC_UUID];
    case 'setSuggestionsForFixEntity':
      return [GENERIC_UUID, null, []];
    case 'getAllFixesWithSuggestionByCreatedAt':
      return [GENERIC_UUID, '2025-01-01'];
    case 'bulkUpdateStatus':
      return [[], 'NEW'];
    case 'getFixEntitiesBySuggestionId':
      return [GENERIC_UUID];
    case 'findByVersion':
      return ['v1'];
    default:
      return [];
  }
};

describe('PostgREST IT - all collections methods coverage', () => {
  const dataAccess = createITDataAccess();

  const entityNames = Object.keys(dataAccess).sort();

  entityNames.forEach((entityName) => {
    const collection = dataAccess[entityName];
    const methodNames = getMethodNames(collection);

    describe(`${entityName} collection`, () => {
      methodNames.forEach((methodName) => {
        it(`invokes ${entityName}.${methodName}()`, async () => {
          const method = collection[methodName];
          expect(method).to.be.a('function');

          const args = getArgsForMethod(entityName, methodName);

          try {
            await method.apply(collection, args);
          } catch (error) {
            expect(error).to.be.instanceOf(Error);

            // Ensure v3 deprecation remains explicit.
            if (entityName === 'KeyEvent' && KEY_EVENT_DEPRECATED_METHODS.has(methodName)) {
              expect(error.message).to.include('KeyEvent is deprecated in data-access v3');
              return;
            }

            // For mutating methods, controlled validation/deprecation errors are acceptable.
            if (isMutatingMethod(methodName)) {
              expect(isExpectedMutationError(error)).to.equal(true);
              return;
            }

            // Read/query paths should not fail in this smoke test.
            throw error;
          }
        });
      });
    });
  });
});
