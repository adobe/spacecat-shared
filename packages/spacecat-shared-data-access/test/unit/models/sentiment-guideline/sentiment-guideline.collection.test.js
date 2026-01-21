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

/* eslint-env mocha */

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import SentimentGuideline from '../../../../src/models/sentiment-guideline/sentiment-guideline.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SentimentGuidelineCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    guidelineId: 'guideline-12345',
    siteId: 'site-12345',
    name: 'Product Quality Focus',
    instruction: 'Analyze sentiment around build quality and materials.',
    enabled: true,
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(SentimentGuideline, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the SentimentGuidelineCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);
      expect(model).to.be.an('object');
    });
  });

  describe('findById', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.findById()).to.be.rejectedWith('Both siteId and guidelineId are required');
    });

    it('throws an error if guidelineId is not provided', async () => {
      await expect(instance.findById('site123')).to.be.rejectedWith('Both siteId and guidelineId are required');
    });

    it('returns the guideline when found', async () => {
      instance.findByIndexKeys = stub().resolves(model);

      const result = await instance.findById('site123', 'guideline-123');

      expect(result).to.equal(model);
      expect(instance.findByIndexKeys).to.have.been.calledOnceWith({
        siteId: 'site123',
        guidelineId: 'guideline-123',
      });
    });

    it('returns null when guideline is not found', async () => {
      instance.findByIndexKeys = stub().resolves(null);

      const result = await instance.findById('site123', 'guideline-999');

      expect(result).to.be.null;
    });
  });

  describe('allBySiteIdPaginated', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.allBySiteIdPaginated()).to.be.rejectedWith('SiteId is required');
    });

    it('returns paginated results', async () => {
      const mockGuideline1 = { getGuidelineId: () => 'guideline-1' };
      const mockGuideline2 = { getGuidelineId: () => 'guideline-2' };

      instance.allByIndexKeys = stub().resolves({ data: [mockGuideline1, mockGuideline2], cursor: 'cursor123' });

      const result = await instance.allBySiteIdPaginated('site123');

      expect(result).to.be.an('object');
      expect(result.data).to.be.an('array').with.lengthOf(2);
      expect(result.cursor).to.equal('cursor123');
    });

    it('returns empty data array when no guidelines exist', async () => {
      instance.allByIndexKeys = stub().resolves({ data: [], cursor: null });

      const result = await instance.allBySiteIdPaginated('site123');

      expect(result.data).to.be.an('array').with.lengthOf(0);
      expect(result.cursor).to.be.null;
    });

    it('passes pagination options to allByIndexKeys', async () => {
      instance.allByIndexKeys = stub().resolves({ data: [], cursor: null });

      await instance.allBySiteIdPaginated('site123', { limit: 50, cursor: 'abc123' });

      const callArgs = instance.allByIndexKeys.getCall(0).args;
      expect(callArgs[1]).to.include({ limit: 50, cursor: 'abc123', returnCursor: true });
    });
  });

  describe('allBySiteIdEnabled', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.allBySiteIdEnabled()).to.be.rejectedWith('SiteId is required');
    });

    it('filters guidelines by enabled using FilterExpression', async () => {
      const mockGuideline1 = { getGuidelineId: () => 'guideline-1', getEnabled: () => true };
      const mockGuideline2 = { getGuidelineId: () => 'guideline-2', getEnabled: () => true };

      instance.allByIndexKeys = stub()
        .resolves({ data: [mockGuideline1, mockGuideline2], cursor: null });

      const result = await instance.allBySiteIdEnabled('site123');

      expect(result).to.be.an('object');
      expect(result.data).to.be.an('array').with.lengthOf(2);

      expect(instance.allByIndexKeys).to.have.been.calledOnce;
      const callArgs = instance.allByIndexKeys.getCall(0).args;
      expect(callArgs[1]).to.have.property('where');
      expect(callArgs[1].returnCursor).to.be.true;
    });
  });

  describe('findByIds', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.findByIds()).to.be.rejectedWith('SiteId is required');
    });

    it('returns empty array when guidelineIds is empty', async () => {
      const result = await instance.findByIds('site123', []);

      expect(result).to.be.an('array').with.lengthOf(0);
    });

    it('returns empty array when guidelineIds is not an array', async () => {
      const result = await instance.findByIds('site123', null);

      expect(result).to.be.an('array').with.lengthOf(0);
    });

    it('returns matching guidelines', async () => {
      const mockGuideline1 = { getGuidelineId: () => 'guideline-1' };
      const mockGuideline2 = { getGuidelineId: () => 'guideline-2' };
      const mockGuideline3 = { getGuidelineId: () => 'guideline-3' };

      instance.allBySiteId = stub().resolves([mockGuideline1, mockGuideline2, mockGuideline3]);

      const result = await instance.findByIds('site123', ['guideline-1', 'guideline-3']);

      expect(result).to.be.an('array').with.lengthOf(2);
      expect(result).to.include(mockGuideline1);
      expect(result).to.include(mockGuideline3);
      expect(result).to.not.include(mockGuideline2);
    });

    it('handles guidelines with guidelineId property instead of method', async () => {
      const mockGuideline1 = { guidelineId: 'guideline-1' };
      const mockGuideline2 = { guidelineId: 'guideline-2' };

      instance.allBySiteId = stub().resolves([mockGuideline1, mockGuideline2]);

      const result = await instance.findByIds('site123', ['guideline-1']);

      expect(result).to.be.an('array').with.lengthOf(1);
      expect(result[0]).to.equal(mockGuideline1);
    });
  });

  describe('removeForSiteId', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.removeForSiteId()).to.be.rejectedWith('SiteId is required');
    });

    it('removes all guidelines for a given siteId', async () => {
      const siteId = 'site-12345';
      const guidelineModel = {
        getGuidelineId: () => 'guideline-001',
      };
      instance.allBySiteId = stub().resolves([guidelineModel]);

      await instance.removeForSiteId(siteId);

      expect(instance.allBySiteId).to.have.been.calledOnceWith(siteId);
      expect(mockElectroService.entities.sentimentGuideline.delete).to.have.been.calledOnceWith([
        { siteId, guidelineId: 'guideline-001' },
      ]);
    });

    it('does not call remove when there are no guidelines', async () => {
      const siteId = 'site-12345';
      instance.allBySiteId = stub().resolves([]);

      await instance.removeForSiteId(siteId);

      expect(instance.allBySiteId).to.have.been.calledOnceWith(siteId);
      expect(mockElectroService.entities.sentimentGuideline.delete).to.not.have.been.called;
    });

    it('handles guidelines with guidelineId property instead of method', async () => {
      const siteId = 'site-12345';
      const guidelineWithProperty = {
        guidelineId: 'guideline-prop-001',
      };
      instance.allBySiteId = stub().resolves([guidelineWithProperty]);

      await instance.removeForSiteId(siteId);

      expect(mockElectroService.entities.sentimentGuideline.delete).to.have.been.calledOnceWith([
        { siteId, guidelineId: 'guideline-prop-001' },
      ]);
    });
  });
});
