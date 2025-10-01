/*
 * Copyright 2025 Adobe. All rights reserved.
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
import { stub } from 'sinon';

import FixEntitySuggestion from '../../../../src/models/fix-entity-suggestion/fix-entity-suggestion.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('FixEntitySuggestionCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    suggestionId: 'suggestion-123',
    fixEntityId: 'fix-456',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(FixEntitySuggestion, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the FixEntitySuggestionCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('allByFixEntityId', () => {
    it('calls allByForeignKey with correct parameters', async () => {
      const fixEntityId = 'fix-entity-123';

      // Mock the inherited allByForeignKey method
      const allByForeignKeyStub = stub().resolves([model]);
      instance.allByForeignKey = allByForeignKeyStub;

      const result = await instance.allByFixEntityId(fixEntityId);

      expect(allByForeignKeyStub).to.have.been.calledOnceWith('fixEntityId', fixEntityId);
      expect(result).to.deep.equal([model]);
    });
  });

  describe('allBySuggestionId', () => {
    it('successfully queries by suggestionId using primary index', async () => {
      const suggestionId = 'suggestion-123';
      const mockJunctionRecords = [
        { suggestionId, fixEntityId: 'fix-456' },
        { suggestionId, fixEntityId: 'fix-789' },
      ];

      // Set up the entity query mock
      const queryStub = stub().returns({
        go: stub().resolves({ data: mockJunctionRecords }),
      });

      mockElectroService.entities.fixEntitySuggestion.query.primary = queryStub;

      // Mock createInstance method
      const createInstanceStub = stub()
        .onFirstCall()
        .returns({ id: 'instance-1' })
        .onSecondCall()
        .returns({ id: 'instance-2' });
      instance.createInstance = createInstanceStub;

      const result = await instance.allBySuggestionId(suggestionId);

      expect(queryStub).to.have.been.calledWith({ suggestionId });
      expect(createInstanceStub).to.have.been.calledTwice;
      expect(result).to.deep.equal([{ id: 'instance-1' }, { id: 'instance-2' }]);
    });

    it('logs and throws error when query fails', async () => {
      const suggestionId = 'suggestion-123';
      const error = new Error('Database query failed');

      const queryStub = stub().returns({
        go: stub().rejects(error),
      });

      mockElectroService.entities.fixEntitySuggestion.query.primary = queryStub;

      await expect(instance.allBySuggestionId(suggestionId))
        .to.be.rejectedWith('Database query failed');

      expect(mockLogger.error).to.have.been.calledWith(
        'Failed to query FixEntitySuggestions by suggestionId: Database query failed',
      );
    });
  });

  describe('createRelationship', () => {
    it('creates a relationship between fix entity and suggestion', async () => {
      const fixEntityId = 'fix-456';
      const suggestionId = 'suggestion-123';
      const expectedData = { fixEntityId, suggestionId };

      const createStub = stub().resolves(model);
      instance.create = createStub;

      const result = await instance.createRelationship(fixEntityId, suggestionId);

      expect(createStub).to.have.been.calledOnceWith(expectedData);
      expect(result).to.equal(model);
    });
  });

  describe('findRelationship', () => {
    it('successfully finds an existing relationship', async () => {
      const suggestionId = 'suggestion-123';
      const fixEntityId = 'fix-456';

      const getStub = stub().returns({
        go: stub().resolves({ data: mockRecord }),
      });

      mockElectroService.entities.fixEntitySuggestion.get = getStub;

      const createInstanceStub = stub().returns(model);
      instance.createInstance = createInstanceStub;

      const result = await instance.findRelationship(suggestionId, fixEntityId);

      expect(getStub).to.have.been.calledWith({ suggestionId, fixEntityId });
      expect(createInstanceStub).to.have.been.calledWith(mockRecord);
      expect(result).to.equal(model);
    });

    it('returns null when relationship is not found', async () => {
      const suggestionId = 'suggestion-123';
      const fixEntityId = 'fix-456';
      const notFoundError = new Error('Item not found');

      const getStub = stub().returns({
        go: stub().rejects(notFoundError),
      });

      mockElectroService.entities.fixEntitySuggestion.get = getStub;

      const result = await instance.findRelationship(suggestionId, fixEntityId);

      expect(result).to.be.null;
    });

    it('throws error for other database errors', async () => {
      const suggestionId = 'suggestion-123';
      const fixEntityId = 'fix-456';
      const error = new Error('Database connection failed');

      const getStub = stub().returns({
        go: stub().rejects(error),
      });

      mockElectroService.entities.fixEntitySuggestion.get = getStub;

      await expect(instance.findRelationship(suggestionId, fixEntityId))
        .to.be.rejectedWith('Database connection failed');
    });
  });

  describe('removeRelationship', () => {
    it('successfully removes an existing relationship', async () => {
      const suggestionId = 'suggestion-123';
      const fixEntityId = 'fix-456';

      const deleteStub = stub().returns({
        go: stub().resolves({}),
      });

      mockElectroService.entities.fixEntitySuggestion.delete = deleteStub;

      await instance.removeRelationship(suggestionId, fixEntityId);

      expect(deleteStub).to.have.been.calledWith({ suggestionId, fixEntityId });
    });

    it('ignores "not found" errors when removing non-existent relationship', async () => {
      const suggestionId = 'suggestion-123';
      const fixEntityId = 'fix-456';
      const notFoundError = new Error('Item not found');

      const deleteStub = stub().returns({
        go: stub().rejects(notFoundError),
      });

      mockElectroService.entities.fixEntitySuggestion.delete = deleteStub;

      // Should not throw an error
      await expect(instance.removeRelationship(suggestionId, fixEntityId))
        .to.be.fulfilled;
    });

    it('throws error for other database errors during removal', async () => {
      const suggestionId = 'suggestion-123';
      const fixEntityId = 'fix-456';
      const error = new Error('Database connection failed');

      const deleteStub = stub().returns({
        go: stub().rejects(error),
      });

      mockElectroService.entities.fixEntitySuggestion.delete = deleteStub;

      await expect(instance.removeRelationship(suggestionId, fixEntityId))
        .to.be.rejectedWith('Database connection failed');
    });
  });
});
