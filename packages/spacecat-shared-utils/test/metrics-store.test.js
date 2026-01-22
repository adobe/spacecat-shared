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

import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import esmock from 'esmock';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getStoredMetrics, storeMetrics } from '../src/metrics-store.js';

use(sinonChai);
use(chaiAsPromised);

describe('Metrics Store', () => {
  let config;
  let context;

  beforeEach(() => {
    config = {
      siteId: 'testSite',
      source: 'testSource',
      metric: 'testMetric',
    };
    context = {
      log: {
        info: sinon.stub(),
        error: sinon.stub(),
        debug: sinon.stub(),
      },
      s3: {
        s3Client: {
          send: sinon.stub(),
        },
        s3Bucket: 'test-bucket',
        region: 'us-west-2',
      },
    };
  });

  describe('getStoredMetrics', () => {
    it('should throw when required params are not set', async () => {
      expect(getStoredMetrics({
        source: 'testSource',
        metric: 'testMetric',
      }, context)).to.eventually.throws('siteId is required to compose metrics storage path');

      expect(getStoredMetrics({
        siteId: 'testSite',
        metric: 'testMetric',
      }, context)).to.eventually.throw('source is required to compose metrics storage path');

      expect(getStoredMetrics({
        source: 'testSource',
        siteId: 'testSite',
      }, context)).to.eventually.throw('metric is required to compose metrics storage path');

      const contextWithoutS3Bucket = {
        log: {
          info: sinon.stub(),
          error: sinon.stub(),
        },
        s3: {
          s3Client: {
            send: sinon.stub(),
          },
          region: 'us-west-2',
        },
      };
      expect(getStoredMetrics(config, contextWithoutS3Bucket)).to.eventually.throw('S3 bucket name is required to get stored metrics');
    });

    it('should return metrics when retrieval is successful', async () => {
      const expectedMetrics = [{
        siteId: '123',
        source: 'ahrefs',
        time: '2023-03-12T00:00:00Z',
        name: 'organic-traffic',
        value: 100,
      }, {
        siteId: '123',
        source: 'ahrefs',
        time: '2023-03-13T00:00:00Z',
        name: 'organic-traffic',
        value: 200,
      }];
      context.s3.s3Client.send.resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(expectedMetrics)),
        },
      });

      const metrics = await getStoredMetrics(config, context);

      expect(metrics).to.deep.equal(expectedMetrics);
      expect(context.s3.s3Client.send.calledWith(sinon.match.instanceOf(GetObjectCommand)))
        .to.be.true;
      expect(context.s3.s3Client.send.calledWith(sinon.match.hasNested(
        'input.Bucket',
        context.s3.s3Bucket,
      ))).to.be.true;
      expect(context.s3.s3Client.send.calledWith(sinon.match.hasNested('input.Key', 'metrics/testSite/testSource/testMetric.json'))).to.be.true;
      expect(context.log.debug).to.have.been.calledWith('Successfully retrieved 2 metrics from metrics/testSite/testSource/testMetric.json');
    });

    it('should return empty array when retrieval fails', async () => {
      context.s3.s3Client.send.rejects(new Error('Test error'));

      const metrics = await getStoredMetrics(config, context);

      expect(metrics).to.deep.equal([]);
      expect(context.log.error).to.have.been.calledWith('Failed to retrieve metrics from metrics/testSite/testSource/testMetric.json, error: Test error');
    });
  });

  describe('storeMetrics', () => {
    it('should throw when required params are not set', async () => {
      expect(storeMetrics('{}', {
        source: 'testSource',
        metric: 'testMetric',
      }, context)).to.eventually.throws('siteId is required to compose metrics storage path');

      expect(storeMetrics('{}', {
        siteId: 'testSite',
        metric: 'testMetric',
      }, context)).to.eventually.throw('source is required to compose metrics storage path');

      expect(storeMetrics('{}', {
        source: 'testSource',
        siteId: 'testSite',
      }, context)).to.eventually.throw('metric is required to compose metrics storage path');

      const contextWithoutS3Bucket = {
        log: {
          info: sinon.stub(),
          error: sinon.stub(),
        },
        s3: {
          s3Client: {
            send: sinon.stub(),
          },
          region: 'us-west-2',
        },
      };
      expect(storeMetrics('{}', config, contextWithoutS3Bucket)).to.eventually.throw('S3 bucket name is required to get stored metrics');
    });

    it('should return file path when upload is successful', async () => {
      const content = [{
        siteId: '123',
        source: 'ahrefs',
        time: '2023-03-12T00:00:00Z',
        name: 'organic-traffic',
        value: 100,
      }, {
        siteId: '123',
        source: 'ahrefs',
        time: '2023-03-13T00:00:00Z',
        name: 'organic-traffic',
        value: 200,
      }];
      context.s3.s3Client.send.resolves({ foo: 'bar' });

      const filePath = await storeMetrics(content, config, context);

      expect(filePath).to.equal('metrics/testSite/testSource/testMetric.json');
      expect(context.s3.s3Client.send.calledWith(sinon.match.instanceOf(PutObjectCommand)))
        .to.be.true;
      expect(context.s3.s3Client.send.calledWith(sinon.match.hasNested('input.Bucket', context.s3.s3Bucket))).to.be.true;
      expect(context.s3.s3Client.send.calledWith(sinon.match.hasNested('input.Key', 'metrics/testSite/testSource/testMetric.json'))).to.be.true;
      expect(context.s3.s3Client.send.calledWith(sinon.match.hasNested('input.Body', JSON.stringify(content, null, 2)))).to.be.true;
      expect(context.s3.s3Client.send.calledWith(sinon.match.hasNested('input.ContentType', 'application/json'))).to.be.true;
      expect(context.log.debug).to.have.been.calledWith('Successfully uploaded metrics to'
        + ' metrics/testSite/testSource/testMetric.json, response: {"foo":"bar"}');
    });

    it('should throw error when upload fails', async () => {
      const content = [{
        siteId: '123',
        source: 'ahrefs',
        time: '2023-03-12T00:00:00Z',
        name: 'organic-traffic',
        value: 100,
      }, {
        siteId: '123',
        source: 'ahrefs',
        time: '2023-03-13T00:00:00Z',
        name: 'organic-traffic',
        value: 200,
      }];
      context.s3.s3Client.send.rejects(new Error('Test error'));

      try {
        await storeMetrics(content, config, context);
      } catch (e) {
        expect(e.message).to.equal('Failed to upload metrics to metrics/testSite/testSource/testMetric.json, error: Test error');
        expect(context.log.error).to.have.been.calledWith('Failed to upload metrics to metrics/testSite/testSource/testMetric.json, error: Test error');
      }
    });
  });

  describe('calculateCPCValue', () => {
    let getObjectFromKeyStub;
    let calculateCPCValueFunc;

    beforeEach(async () => {
      getObjectFromKeyStub = sinon.stub();
      const { calculateCPCValue } = await esmock('../src/metrics-store.js', {
        '../src/s3.js': {
          getObjectFromKey: getObjectFromKeyStub,
        },
      });
      context = {
        s3Client: {},
        log: {
          warn: sinon.stub(),
          error: sinon.stub(),
        },
        env: {
          S3_IMPORTER_BUCKET_NAME: 'test-bucket',
        },
      };
      calculateCPCValueFunc = calculateCPCValue;
    });

    it('should calculate CPC value correctly from organic traffic data', async () => {
      const organicTrafficData = [
        { cost: 150000, value: 10000 },
        { cost: 200000, value: 5000 },
      ];
      getObjectFromKeyStub.resolves(organicTrafficData);

      const result = await calculateCPCValueFunc(context, 'test-site');

      expect(result).to.deep.equal({ success: true, value: 0.4 }); // 200000 / 5000 / 100 = 0.4
      expect(getObjectFromKeyStub).to.have.been.calledWith(
        context.s3Client,
        'test-bucket',
        'metrics/test-site/ahrefs/organic-traffic.json',
        context.log,
      );
    });

    it('should return default CPC value when organic traffic data is not available', async () => {
      getObjectFromKeyStub.resolves(null);

      const result = await calculateCPCValueFunc(context, 'test-site');

      expect(result).to.deep.equal({
        success: false,
        reason: 'Organic traffic data not available',
        value: 1.5,
      });
      expect(context.log.warn).to.have.been.calledWith('Organic traffic data not available for test-site. Using Default CPC value.');
    });

    it('should return default CPC value when organic traffic data is empty array', async () => {
      getObjectFromKeyStub.resolves([]);

      const result = await calculateCPCValueFunc(context, 'test-site');

      expect(result).to.deep.equal({
        success: false,
        reason: 'Organic traffic data not available',
        value: 1.5,
      });
      expect(context.log.warn).to.have.been.calledWith('Organic traffic data not available for test-site. Using Default CPC value.');
    });

    it('should return default CPC value when cost is missing', async () => {
      const organicTrafficData = [
        { cost: 150000, value: 10000 },
        { value: 5000 },
      ];
      getObjectFromKeyStub.resolves(organicTrafficData);

      const result = await calculateCPCValueFunc(context, 'test-site');

      expect(result).to.deep.equal({
        success: false,
        reason: 'Invalid organic traffic data',
        value: 1.5,
      });
      expect(context.log.warn).to.have.been.calledWith('Invalid organic traffic data present for test-site - cost:undefined value:5000, Using Default CPC value.');
    });

    it('should return default CPC value when value is missing', async () => {
      const organicTrafficData = [
        { cost: 150000, value: 10000 },
        { cost: 200000 },
      ];
      getObjectFromKeyStub.resolves(organicTrafficData);

      const result = await calculateCPCValueFunc(context, 'test-site');

      expect(result).to.deep.equal({
        success: false,
        reason: 'Invalid organic traffic data',
        value: 1.5,
      });
      expect(context.log.warn).to.have.been.calledWith('Invalid organic traffic data present for test-site - cost:200000 value:undefined, Using Default CPC value.');
    });

    it('should return default CPC value on error', async () => {
      getObjectFromKeyStub.rejects(new Error('S3 error'));

      try {
        await calculateCPCValueFunc(context, 'test-site');
        expect.fail('Should have thrown a ReferenceError');
      } catch (e) {
        expect(e).to.be.instanceOf(ReferenceError);
        expect(e.message).to.equal('DEFAULT_CPC_VALUE is not defined');
      }
    });

    it('should throw error when S3_IMPORTER_BUCKET_NAME is missing', async () => {
      context.env.S3_IMPORTER_BUCKET_NAME = null;

      try {
        await calculateCPCValueFunc(context, 'test-site');
        expect.fail('Should have thrown an error');
      } catch (e) {
        expect(e.message).to.equal('S3 importer bucket name is required');
      }
    });

    it('should throw error when s3Client is missing', async () => {
      context.s3Client = null;

      try {
        await calculateCPCValueFunc(context, 'test-site');
        expect.fail('Should have thrown an error');
      } catch (e) {
        expect(e.message).to.equal('S3 client is required');
      }
    });

    it('should throw error when log is missing', async () => {
      context.log = null;

      try {
        await calculateCPCValueFunc(context, 'test-site');
        expect.fail('Should have thrown an error');
      } catch (e) {
        expect(e.message).to.equal('Logger is required');
      }
    });

    it('should throw error when siteId is missing', async () => {
      try {
        await calculateCPCValueFunc(context, null);
        expect.fail('Should have thrown an error');
      } catch (e) {
        expect(e.message).to.equal('SiteId is required');
      }
    });
  });
});
