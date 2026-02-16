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
  'allBySiteId',
  'allBySiteIdAndTime',
  'findById',
  'findByIndexKeys',
  'findBySiteId',
  'findBySiteIdAndTime',
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

const EXPECTED_INVOCATION_ERROR_PATTERNS = [
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
  'Failed to query',
  'invalid input value for enum',
  'not configured',
  'schema cache',
];

const isMutatingMethod = (methodName) => MUTATING_METHOD_PREFIXES
  .some((prefix) => methodName.startsWith(prefix))
  || MUTATING_METHODS.has(methodName);

const collectErrorMessages = (error) => {
  const messages = [];
  let current = error;
  while (current) {
    if (current.message) {
      messages.push(current.message);
    }
    current = current.cause;
  }
  return messages.join(' | ');
};

const isExpectedInvocationError = (error) => {
  const message = collectErrorMessages(error);
  return EXPECTED_INVOCATION_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

const getValueForField = (fieldName) => {
  switch (fieldName) {
    case 'organizationId':
      return TEST_IDS.organizationId;
    case 'projectId':
      return TEST_IDS.projectId;
    case 'siteId':
      return TEST_IDS.siteId;
    case 'siteCandidateId':
    case 'apiKeyId':
    case 'asyncJobId':
    case 'auditId':
    case 'auditUrlId':
    case 'consumerId':
    case 'entitlementId':
    case 'experimentId':
    case 'fixEntityId':
    case 'importJobId':
    case 'importUrlId':
    case 'latestAuditId':
    case 'opportunityId':
    case 'pageCitabilityId':
    case 'pageIntentId':
    case 'projectedTrafficId':
    case 'reportId':
    case 'scrapeJobId':
    case 'scrapeUrlId':
    case 'sentimentGuidelineId':
    case 'sentimentTopicId':
    case 'siteEnrollmentId':
    case 'siteTopFormId':
    case 'siteTopPageId':
    case 'suggestionId':
    case 'trialUserActivityId':
    case 'trialUserId':
      return GENERIC_UUID;
    case 'auditType':
      return '404';
    case 'status':
      return 'RUNNING';
    case 'deliveryType':
      return 'AEM_EDGE';
    case 'productCode':
      return 'LLMO';
    case 'url':
      return GENERIC_URL;
    case 'baseURL':
      return TEST_VALUES.siteBaseURL;
    case 'previewURL':
      return TEST_VALUES.csPreviewURL;
    case 'projectName':
      return TEST_VALUES.projectName;
    case 'hashedApiKey':
      return 'hashed-key';
    case 'imsOrgId':
      return 'ims-org@AdobeOrg';
    case 'imsUserId':
      return 'ims-user';
    case 'expId':
      return 'exp-1';
    case 'processingType':
      return 'default';
    case 'isOriginal':
      return true;
    case 'rank':
      return 1;
    case 'traffic':
      return 1;
    case 'time':
    case 'createdAt':
    case 'updatedAt':
    case 'startedAt':
      return new Date().toISOString();
    case 'fixEntityCreatedDate':
      return '2025-01-01';
    case 'byCustomer':
      return true;
    case 'formSource':
      return 'newsletter';
    case 'source':
      return 'organic';
    case 'geo':
      return 'global';
    default:
      return GENERIC_UUID;
  }
};

const getArgsFromMethodName = (methodName) => {
  const match = methodName.match(/^(allBy|findBy)(.+)$/);
  if (!match) {
    return null;
  }

  const [, prefix, keysPart] = match;
  const fields = keysPart
    .split('And')
    .filter(Boolean)
    .map((part) => part.charAt(0).toLowerCase() + part.slice(1));
  const values = fields.map((field) => getValueForField(field));

  if (prefix === 'allBy') {
    return values;
  }
  return values;
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
      if (entityName === 'FixEntitySuggestion') {
        return [[{ suggestionId: GENERIC_UUID, fixEntityId: GENERIC_UUID }]];
      }
      return [[{ id: GENERIC_UUID }]];
    case 'create':
      return [{}];
    case 'createMany':
      return [[{}]];
    case 'updateByKeys':
      return [{ id: GENERIC_UUID }, {}];
    case 'applyUpdateWatchers':
      return [{ updatedAt: new Date().toISOString() }, { updatedAt: new Date().toISOString() }];
    case 'removeByIds':
      return [[GENERIC_UUID]];
    case 'removeByIndexKeys':
      return [[{ id: GENERIC_UUID }]];
    case 'allByDateRange':
      return ['2025-01-01T00:00:00.000Z', '2025-02-01T00:00:00.000Z'];
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
      return [TEST_IDS.siteId, '404'];
    case 'allBySiteIdSorted':
      return [TEST_IDS.siteId];
    case 'allBySiteIdByCustomerSorted':
      return [TEST_IDS.siteId, true];
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
      return getArgsFromMethodName(methodName) || [];
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

            // For mutating methods and synthetic-argument validation in this smoke test,
            // controlled errors are acceptable.
            if (isMutatingMethod(methodName) || isExpectedInvocationError(error)) {
              expect(isExpectedInvocationError(error)).to.equal(true);
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
