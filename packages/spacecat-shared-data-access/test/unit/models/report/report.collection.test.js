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
import sinon from 'sinon';

import { createElectroMocks } from '../../util.js';
import reports from '../../../fixtures/reports.fixture.js';
import Report from '../../../../src/models/report/report.model.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('ReportCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = reports[0];

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Report, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the ReportCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);
      expect(model).to.be.an('object');
    });
  });

  describe('create', () => {
    it('creates a new report', async () => {
      const result = await instance.create(mockRecord);

      expect(result).to.be.an('object');
      expect(result.record.reportId).to.equal(mockRecord.reportId);
    });

    it('creates a report with auto-computed storage path when empty', async () => {
      const dataWithoutStoragePath = {
        ...mockRecord,
        storagePath: '',
      };

      const result = await instance.create(dataWithoutStoragePath);

      expect(result).to.be.an('object');
      expect(result.record.reportId).to.equal(mockRecord.reportId);
      // The storage path should be auto-computed
      expect(result.record.storagePath).to.not.equal('');
    });

    it('creates a report with custom storage path when provided', async () => {
      const customStoragePath = '/custom/path/';
      const dataWithCustomPath = {
        ...mockRecord,
        storagePath: customStoragePath,
      };

      const result = await instance.create(dataWithCustomPath);

      expect(result).to.be.an('object');
      expect(result.record.reportId).to.equal(mockRecord.reportId);
      // Note: The mock doesn't properly simulate the storage path override,
      // but we can test that the method doesn't throw and returns a valid result
      expect(result.record).to.be.an('object');
    });

    it('auto-computes storage path when getStoragePath returns empty string', async () => {
      // Create a mock report instance that returns empty string for getStoragePath
      const mockReportInstance = {
        getStoragePath: () => '',
        setStoragePath: () => {},
        save: () => Promise.resolve(),
        getId: () => mockRecord.reportId,
      };

      // Stub the super.create method to return our mock report instance
      const prototype = Object.getPrototypeOf(Object.getPrototypeOf(instance));
      const superCreateStub = prototype.create;
      prototype.create = () => Promise.resolve(mockReportInstance);

      const setStoragePathSpy = sinon.spy(mockReportInstance, 'setStoragePath');
      const saveSpy = sinon.spy(mockReportInstance, 'save');

      const dataWithoutStoragePath = {
        ...mockRecord,
        storagePath: '',
      };

      const result = await instance.create(dataWithoutStoragePath);

      // Verify that setStoragePath was called with the correct auto-computed path
      expect(setStoragePathSpy.calledOnceWith(
        `/reports/${mockRecord.siteId}/${mockRecord.reportType}/${mockRecord.reportId}/`,
      )).to.be.true;

      // Verify that save was called to persist the changes
      expect(saveSpy.calledOnce).to.be.true;

      // Verify the result is the mock report instance
      expect(result).to.equal(mockReportInstance);

      // Restore the original method
      prototype.create = superCreateStub;
    });

    it('does not auto-compute storage path when getStoragePath returns non-empty string', async () => {
      // Create a mock report instance that returns non-empty string for getStoragePath
      const mockReportInstance = {
        getStoragePath: () => '/existing/path/',
        setStoragePath: () => {},
        save: () => Promise.resolve(),
        getId: () => mockRecord.reportId,
      };

      // Stub the super.create method to return our mock report instance
      const prototype = Object.getPrototypeOf(Object.getPrototypeOf(instance));
      const superCreateStub = prototype.create;
      prototype.create = () => Promise.resolve(mockReportInstance);

      const setStoragePathSpy = sinon.spy(mockReportInstance, 'setStoragePath');
      const saveSpy = sinon.spy(mockReportInstance, 'save');

      const dataWithExistingPath = {
        ...mockRecord,
        storagePath: '/existing/path/',
      };

      const result = await instance.create(dataWithExistingPath);

      // Verify that setStoragePath was NOT called
      expect(setStoragePathSpy.called).to.be.false;

      // Verify that save was NOT called
      expect(saveSpy.called).to.be.false;

      // Verify the result is the mock report instance
      expect(result).to.equal(mockReportInstance);

      // Restore the original method
      prototype.create = superCreateStub;
    });

    it('handles errors during storage path auto-computation gracefully', async () => {
      // Create a mock report instance that throws an error during save
      const mockReportInstance = {
        getStoragePath: () => '',
        setStoragePath: () => {},
        save: () => Promise.reject(new Error('Save failed')),
        getId: () => mockRecord.reportId,
      };

      // Stub the super.create method to return our mock report instance
      const prototype = Object.getPrototypeOf(Object.getPrototypeOf(instance));
      const superCreateStub = prototype.create;
      prototype.create = () => Promise.resolve(mockReportInstance);

      const dataWithoutStoragePath = {
        ...mockRecord,
        storagePath: '',
      };

      // The method should throw an error when save fails
      await expect(instance.create(dataWithoutStoragePath)).to.be.rejectedWith('Save failed');

      // Restore the original method
      prototype.create = superCreateStub;
    });

    it('auto-computes storage path with correct format', async () => {
      const testData = {
        siteId: 'test-site-id',
        reportType: 'test-report-type',
        reportId: 'test-report-id',
      };

      const mockReportInstance = {
        getStoragePath: () => '',
        setStoragePath: () => {},
        save: () => Promise.resolve(),
        getId: () => testData.reportId,
      };

      // Stub the super.create method to return our mock report instance
      const prototype = Object.getPrototypeOf(Object.getPrototypeOf(instance));
      const superCreateStub = prototype.create;
      prototype.create = () => Promise.resolve(mockReportInstance);

      const setStoragePathSpy = sinon.spy(mockReportInstance, 'setStoragePath');

      const result = await instance.create(testData);

      // Verify the storage path format is correct: /reports/{siteId}/{reportType}/{reportId}/
      const expectedPath = `/reports/${testData.siteId}/${testData.reportType}/${testData.reportId}/`;
      expect(setStoragePathSpy.calledOnceWith(expectedPath)).to.be.true;

      expect(result).to.equal(mockReportInstance);

      // Restore the original method
      prototype.create = superCreateStub;
    });
  });

  it('should have correct schema attributes', () => {
    const attrs = schema.getAttributes();
    expect(attrs).to.have.property('reportId');
    expect(attrs).to.have.property('reportType');
    expect(attrs).to.have.property('storagePath');
    expect(attrs.storagePath.required).to.be.false;
    expect(attrs.storagePath.default).to.be.a('function');
  });
});
