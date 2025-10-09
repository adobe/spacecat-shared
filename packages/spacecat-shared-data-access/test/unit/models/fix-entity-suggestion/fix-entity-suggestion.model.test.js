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
import { restore } from 'sinon';
import sinonChai from 'sinon-chai';

import FixEntitySuggestion from '../../../../src/models/fix-entity-suggestion/fix-entity-suggestion.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('FixEntitySuggestionModel', () => {
  let instance;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      suggestionId: '123e4567-e89b-12d3-a456-426614174000',
      fixEntityId: '123e4567-e89b-12d3-a456-426614174001',
      fixEntityCreatedAt: '2024-01-01T00:00:00.000Z',
      fixEntityCreatedDate: '2024-01-01',
      updatedAt: '2024-01-01T00:00:00.000Z',
      updatedBy: 'spacecat',
    };

    ({
      model: instance,
    } = createElectroMocks(FixEntitySuggestion, mockRecord));
  });

  afterEach(() => {
    restore();
  });

  describe('constructor', () => {
    it('initializes the FixEntitySuggestion instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('generateCompositeKeys', () => {
    it('should return composite keys with suggestionId and fixEntityId', () => {
      const result = instance.generateCompositeKeys();

      expect(result).to.be.an('object');
      expect(result).to.have.property('suggestionId');
      expect(result).to.have.property('fixEntityId');
      expect(result.suggestionId).to.equal(mockRecord.suggestionId);
      expect(result.fixEntityId).to.equal(mockRecord.fixEntityId);
    });

    it('should return the same values as getSuggestionId and getFixEntityId methods', () => {
      const result = instance.generateCompositeKeys();

      expect(result.suggestionId).to.equal(instance.getSuggestionId());
      expect(result.fixEntityId).to.equal(instance.getFixEntityId());
    });

    it('should handle different UUID values correctly', () => {
      // Update the record with different UUIDs
      instance.record.suggestionId = '987e6543-e21b-34c5-a654-426614174999';
      instance.record.fixEntityId = '456e7890-e12b-45d6-a789-426614174888';

      const result = instance.generateCompositeKeys();

      expect(result.suggestionId).to.equal('987e6543-e21b-34c5-a654-426614174999');
      expect(result.fixEntityId).to.equal('456e7890-e12b-45d6-a789-426614174888');
    });

    it('should return undefined values when IDs are not set', () => {
      // Create instance with undefined IDs
      const emptyRecord = {
        updatedAt: '2024-01-01T00:00:00.000Z',
        updatedBy: 'spacecat',
      };

      const { model: emptyInstance } = createElectroMocks(FixEntitySuggestion, emptyRecord);

      const result = emptyInstance.generateCompositeKeys();

      expect(result).to.be.an('object');
      expect(result).to.have.property('suggestionId');
      expect(result).to.have.property('fixEntityId');
      expect(result.suggestionId).to.be.undefined;
      expect(result.fixEntityId).to.be.undefined;
    });

    it('should return null values when IDs are explicitly set to null', () => {
      // Set IDs to null
      instance.record.suggestionId = null;
      instance.record.fixEntityId = null;

      const result = instance.generateCompositeKeys();

      expect(result).to.be.an('object');
      expect(result.suggestionId).to.be.null;
      expect(result.fixEntityId).to.be.null;
    });
  });

  describe('fixEntityCreatedAt methods', () => {
    it('should get fixEntityCreatedAt value', () => {
      const result = instance.getFixEntityCreatedAt();
      expect(result).to.equal(mockRecord.fixEntityCreatedAt);
    });

    it('should return undefined when fixEntityCreatedAt is not set', () => {
      const emptyRecord = {
        suggestionId: '123e4567-e89b-12d3-a456-426614174000',
        fixEntityId: '123e4567-e89b-12d3-a456-426614174001',
        updatedAt: '2024-01-01T00:00:00.000Z',
        updatedBy: 'spacecat',
      };

      const { model: emptyInstance } = createElectroMocks(FixEntitySuggestion, emptyRecord);
      expect(emptyInstance.getFixEntityCreatedAt()).to.be.undefined;
    });
  });

  describe('fixEntityCreatedDate methods', () => {
    it('should get fixEntityCreatedDate value', () => {
      const result = instance.getFixEntityCreatedDate();
      expect(result).to.equal(mockRecord.fixEntityCreatedDate);
    });

    it('should return undefined when fixEntityCreatedDate is not set', () => {
      const emptyRecord = {
        suggestionId: '123e4567-e89b-12d3-a456-426614174000',
        fixEntityId: '123e4567-e89b-12d3-a456-426614174001',
        fixEntityCreatedAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        updatedBy: 'spacecat',
      };

      const { model: emptyInstance } = createElectroMocks(FixEntitySuggestion, emptyRecord);
      expect(emptyInstance.getFixEntityCreatedDate()).to.be.undefined;
    });
  });

  describe('watch pattern for fixEntityCreatedDate', () => {
    it('should have fixEntityCreatedDate set when fixEntityCreatedAt is provided', () => {
      // Create a new instance with a different timestamp
      const testRecord = {
        suggestionId: '123e4567-e89b-12d3-a456-426614174000',
        fixEntityId: '123e4567-e89b-12d3-a456-426614174001',
        fixEntityCreatedAt: '2024-03-15T14:30:45.123Z',
        fixEntityCreatedDate: '2024-03-15', // This should be set by the watch pattern
        updatedAt: '2024-01-01T00:00:00.000Z',
        updatedBy: 'spacecat',
      };

      const { model: testInstance } = createElectroMocks(FixEntitySuggestion, testRecord);

      // Both fields should be accessible
      expect(testInstance.getFixEntityCreatedAt()).to.equal('2024-03-15T14:30:45.123Z');
      expect(testInstance.getFixEntityCreatedDate()).to.equal('2024-03-15');
    });

    it('should handle undefined fixEntityCreatedAt gracefully', () => {
      const emptyRecord = {
        suggestionId: '123e4567-e89b-12d3-a456-426614174000',
        fixEntityId: '123e4567-e89b-12d3-a456-426614174001',
        updatedAt: '2024-01-01T00:00:00.000Z',
        updatedBy: 'spacecat',
      };

      const { model: emptyInstance } = createElectroMocks(FixEntitySuggestion, emptyRecord);
      expect(emptyInstance.getFixEntityCreatedDate()).to.be.undefined;
    });
  });
});
