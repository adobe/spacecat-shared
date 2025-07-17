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
    it('creates a new latest audit', async () => {
      const result = await instance.create(mockRecord);

      expect(result).to.be.an('object');
      expect(result.record.reportId).to.equal(mockRecord.reportId);
    });
  });

  it('should have correct schema attributes', () => {
    const attrs = schema.getAttributes();
    expect(attrs).to.have.property('reportId');
    expect(attrs).to.have.property('reportType');
  });
});
