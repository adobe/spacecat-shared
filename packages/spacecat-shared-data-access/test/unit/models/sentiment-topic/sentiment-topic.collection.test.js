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

import SentimentTopic from '../../../../src/models/sentiment-topic/sentiment-topic.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SentimentTopicCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    topicId: 'topic-12345',
    siteId: 'site-12345',
    name: 'BMW XM Latest',
    description: 'Track sentiment around the BMW XM luxury SUV',
    topicName: 'BMW XM 2026',
    subPrompts: ['What about performance?'],
    guidelineIds: ['guideline-001'],
    audits: ['wikipedia-analysis'],
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
    } = createElectroMocks(SentimentTopic, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the SentimentTopicCollection instance correctly', () => {
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
      await expect(instance.findById()).to.be.rejectedWith('Both siteId and topicId are required');
    });

    it('throws an error if topicId is not provided', async () => {
      await expect(instance.findById('site123')).to.be.rejectedWith('Both siteId and topicId are required');
    });

    it('returns the topic when found', async () => {
      instance.findByIndexKeys = stub().resolves(model);

      const result = await instance.findById('site123', 'topic-123');

      expect(result).to.equal(model);
      expect(instance.findByIndexKeys).to.have.been.calledOnceWith({
        siteId: 'site123',
        topicId: 'topic-123',
      });
    });

    it('returns null when topic is not found', async () => {
      instance.findByIndexKeys = stub().resolves(null);

      const result = await instance.findById('site123', 'topic-999');

      expect(result).to.be.null;
    });
  });

  describe('allBySiteIdPaginated', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.allBySiteIdPaginated()).to.be.rejectedWith('SiteId is required');
    });

    it('returns paginated results', async () => {
      const mockTopic1 = { getTopicId: () => 'topic-1' };
      const mockTopic2 = { getTopicId: () => 'topic-2' };

      instance.allByIndexKeys = stub().resolves({ data: [mockTopic1, mockTopic2], cursor: 'cursor123' });

      const result = await instance.allBySiteIdPaginated('site123');

      expect(result).to.be.an('object');
      expect(result.data).to.be.an('array').with.lengthOf(2);
      expect(result.cursor).to.equal('cursor123');
    });

    it('returns empty data array when no topics exist', async () => {
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

  describe('allBySiteIdAndAuditType', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.allBySiteIdAndAuditType()).to.be.rejectedWith('Both siteId and auditType are required');
    });

    it('throws an error if auditType is not provided', async () => {
      await expect(instance.allBySiteIdAndAuditType('site123')).to.be.rejectedWith('Both siteId and auditType are required');
    });

    it('filters topics by audit type using FilterExpression', async () => {
      const mockTopic1 = { getTopicId: () => 'topic-1' };
      const mockTopic2 = { getTopicId: () => 'topic-2' };

      instance.allByIndexKeys = stub().resolves({ data: [mockTopic1, mockTopic2], cursor: 'cursor123' });

      const result = await instance.allBySiteIdAndAuditType('site123', 'wikipedia-analysis');

      expect(result).to.be.an('object');
      expect(result.data).to.be.an('array').with.lengthOf(2);
      expect(result.cursor).to.equal('cursor123');

      expect(instance.allByIndexKeys).to.have.been.calledOnce;
      const callArgs = instance.allByIndexKeys.getCall(0).args;
      expect(callArgs[0]).to.deep.equal({ siteId: 'site123' });
      expect(callArgs[1]).to.have.property('where');
      expect(callArgs[1].returnCursor).to.be.true;
    });

    it('returns empty data array when no topics match', async () => {
      instance.allByIndexKeys = stub().resolves({ data: [], cursor: null });

      const result = await instance.allBySiteIdAndAuditType('site123', 'reddit-analysis');

      expect(result.data).to.be.an('array').with.lengthOf(0);
      expect(result.cursor).to.be.null;
    });
  });

  describe('allBySiteIdEnabled', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.allBySiteIdEnabled()).to.be.rejectedWith('SiteId is required');
    });

    it('filters topics by enabled using FilterExpression', async () => {
      const mockTopic1 = { getTopicId: () => 'topic-1', getEnabled: () => true };
      const mockTopic2 = { getTopicId: () => 'topic-2', getEnabled: () => true };

      instance.allByIndexKeys = stub().resolves({ data: [mockTopic1, mockTopic2], cursor: null });

      const result = await instance.allBySiteIdEnabled('site123');

      expect(result).to.be.an('object');
      expect(result.data).to.be.an('array').with.lengthOf(2);

      expect(instance.allByIndexKeys).to.have.been.calledOnce;
      const callArgs = instance.allByIndexKeys.getCall(0).args;
      expect(callArgs[1]).to.have.property('where');
      expect(callArgs[1].returnCursor).to.be.true;
    });
  });

  describe('removeForSiteId', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.removeForSiteId()).to.be.rejectedWith('SiteId is required');
    });

    it('removes all topics for a given siteId', async () => {
      const siteId = 'site-12345';
      const topicModel = {
        getTopicId: () => 'topic-001',
      };
      instance.allBySiteId = stub().resolves([topicModel]);

      await instance.removeForSiteId(siteId);

      expect(instance.allBySiteId).to.have.been.calledOnceWith(siteId);
      expect(mockElectroService.entities.sentimentTopic.delete).to.have.been.calledOnceWith([
        { siteId, topicId: 'topic-001' },
      ]);
    });

    it('does not call remove when there are no topics', async () => {
      const siteId = 'site-12345';
      instance.allBySiteId = stub().resolves([]);

      await instance.removeForSiteId(siteId);

      expect(instance.allBySiteId).to.have.been.calledOnceWith(siteId);
      expect(mockElectroService.entities.sentimentTopic.delete).to.not.have.been.called;
    });

    it('handles topics with topicId property instead of method', async () => {
      const siteId = 'site-12345';
      const topicWithProperty = {
        topicId: 'topic-prop-001',
      };
      instance.allBySiteId = stub().resolves([topicWithProperty]);

      await instance.removeForSiteId(siteId);

      expect(mockElectroService.entities.sentimentTopic.delete).to.have.been.calledOnceWith([
        { siteId, topicId: 'topic-prop-001' },
      ]);
    });
  });
});
