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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

import Suggestion from '../../../../src/models/suggestion/suggestion.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SuggestionCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    suggestionId: 's12345',
    opportunityId: 'op67890',
    data: {
      title: 'Test Suggestion',
      description: 'This is a test suggestion.',
    },
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Suggestion, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the SuggestionCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('bulkUpdateStatus', () => {
    it('updates the status of multiple suggestions', async () => {
      const mockSuggestions = [model];
      const mockStatus = 'NEW';
      const originalUpdatedAt = model.record.updatedAt;

      await instance.bulkUpdateStatus(mockSuggestions, mockStatus);

      expect(mockElectroService.entities.suggestion.put.calledOnce).to.be.true;
      const putCallArgs = mockElectroService.entities.suggestion.put.firstCall.args[0];
      expect(putCallArgs).to.be.an('array').with.length(1);
      expect(putCallArgs[0]).to.have.property('suggestionId', 's12345');
      expect(putCallArgs[0]).to.have.property('opportunityId', 'op67890');
      expect(putCallArgs[0]).to.have.property('status', 'NEW');
      expect(putCallArgs[0]).to.have.property('updatedAt').that.is.a('string');
      expect(putCallArgs[0].data).to.deep.equal({
        title: 'Test Suggestion',
        description: 'This is a test suggestion.',
      });

      // Verify that updatedAt was updated in the local objects
      expect(model.record.updatedAt).to.not.equal(originalUpdatedAt);
      expect(model.record.updatedAt).to.be.a('string');
      expect(new Date(model.record.updatedAt).getTime()).to.be.closeTo(Date.now(), 1000);
    });

    it('throws an error if suggestions is not an array', async () => {
      await expect(instance.bulkUpdateStatus({}, 'NEW'))
        .to.be.rejectedWith('Suggestions must be an array');
    });

    it('throws an error if status is not provided', async () => {
      await expect(instance.bulkUpdateStatus([model], 'foo'))
        .to.be.rejectedWith('Invalid status: foo. Must be one of: NEW, APPROVED, IN_PROGRESS, SKIPPED, FIXED, ERROR');
    });
  });
});
