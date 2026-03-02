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
import { stub, restore } from 'sinon';
import sinonChai from 'sinon-chai';

import FixEntity from '../../../../src/models/fix-entity/fix-entity.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('FixEntityModel', () => {
  let instance;
  let mockEntityRegistry;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      fixEntityId: '123e4567-e89b-12d3-a456-426614174000',
      opportunityId: '123e4567-e89b-12d3-a456-426614174001',
      type: 'SEO',
      status: 'PENDING',
      changeDetails: { field: 'title', oldValue: 'Old', newValue: 'New' },
      executedAt: '2024-01-01T00:00:00.000Z',
      executedBy: 'user123',
      publishedAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    ({
      mockEntityRegistry,
      model: instance,
    } = createElectroMocks(FixEntity, mockRecord));
  });

  afterEach(() => {
    restore();
  });

  describe('constructor', () => {
    it('initializes the FixEntity instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('static properties', () => {
    describe('DEFAULT_UPDATED_BY', () => {
      it('should have the correct default value', () => {
        expect(FixEntity.DEFAULT_UPDATED_BY).to.equal('spacecat');
      });
    });

    describe('STATUSES', () => {
      it('should define all status constants', () => {
        expect(FixEntity.STATUSES).to.deep.equal({
          PENDING: 'PENDING',
          DEPLOYED: 'DEPLOYED',
          PUBLISHED: 'PUBLISHED',
          FAILED: 'FAILED',
          ROLLED_BACK: 'ROLLED_BACK',
        });
      });

      it('should have PENDING status', () => {
        expect(FixEntity.STATUSES.PENDING).to.equal('PENDING');
      });

      it('should have DEPLOYED status', () => {
        expect(FixEntity.STATUSES.DEPLOYED).to.equal('DEPLOYED');
      });

      it('should have PUBLISHED status', () => {
        expect(FixEntity.STATUSES.PUBLISHED).to.equal('PUBLISHED');
      });

      it('should have FAILED status', () => {
        expect(FixEntity.STATUSES.FAILED).to.equal('FAILED');
      });

      it('should have ROLLED_BACK status', () => {
        expect(FixEntity.STATUSES.ROLLED_BACK).to.equal('ROLLED_BACK');
      });
    });

    describe('ORIGINS', () => {
      it('should define all origin constants', () => {
        expect(FixEntity.ORIGINS).to.deep.equal({
          SPACECAT: 'spacecat',
          ASO: 'aso',
          REPORTING: 'reporting',
        });
      });

      it('should have SPACECAT origin', () => {
        expect(FixEntity.ORIGINS.SPACECAT).to.equal('spacecat');
      });

      it('should have ASO origin', () => {
        expect(FixEntity.ORIGINS.ASO).to.equal('aso');
      });

      it('should have REPORTING origin', () => {
        expect(FixEntity.ORIGINS.REPORTING).to.equal('reporting');
      });
    });
  });

  describe('getSuggestions', () => {
    it('should get suggestions for the fix entity', async () => {
      const mockSuggestions = [
        { id: 'suggestion-1', title: 'Suggestion 1' },
        { id: 'suggestion-2', title: 'Suggestion 2' },
      ];

      const mockFixEntityCollection = {
        getSuggestionsByFixEntityId: stub().resolves(mockSuggestions),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntityCollection')
        .returns(mockFixEntityCollection);

      const result = await instance.getSuggestions();

      expect(result).to.deep.equal(mockSuggestions);
      expect(mockFixEntityCollection.getSuggestionsByFixEntityId)
        .to.have.been.calledOnceWith(instance.getId());
    });

    it('should return empty array when no suggestions found', async () => {
      const mockFixEntityCollection = {
        getSuggestionsByFixEntityId: stub().resolves([]),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntityCollection')
        .returns(mockFixEntityCollection);

      const result = await instance.getSuggestions();

      expect(result).to.deep.equal([]);
      expect(mockFixEntityCollection.getSuggestionsByFixEntityId)
        .to.have.been.calledOnceWith(instance.getId());
    });

    it('should propagate errors from collection method', async () => {
      const error = new Error('Database error');
      const mockFixEntityCollection = {
        getSuggestionsByFixEntityId: stub().rejects(error),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntityCollection')
        .returns(mockFixEntityCollection);

      await expect(instance.getSuggestions())
        .to.be.rejectedWith('Database error');

      expect(mockFixEntityCollection.getSuggestionsByFixEntityId)
        .to.have.been.calledOnceWith(instance.getId());
    });
  });
});
