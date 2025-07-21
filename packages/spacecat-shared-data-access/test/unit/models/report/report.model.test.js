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
import { Report } from '../../../../src/models/report/index.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleReport = reports[0];

describe('ReportModel', () => {
  let instance;
  let mockRecord;

  beforeEach(() => {
    const acls = [{
      acl: [{
        actions: ['C', 'R', 'U', 'D'],
        path: '/site/*/report',
      },
      {
        actions: ['C', 'R', 'U', 'D'],
        path: '/site/*/report/**',
      }],
    }];
    mockRecord = { ...sampleReport };
    ({
      model: instance,
    } = createElectroMocks(Report, mockRecord));

    // Set up proper ACL context
    instance.aclCtx = {
      acls,
      aclEntities: {
        exclude: [], // Exclude report from ACL checking for tests
      },
    };
  });

  describe('constructor', () => {
    it('initializes the Report instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('reportId', () => {
    it('gets reportId', () => {
      expect(instance.getId()).to.equal(sampleReport.reportId);
    });
  });

  describe('reportType', () => {
    it('gets reportType', () => {
      expect(instance.getReportType()).to.equal(sampleReport.reportType);
    });
  });

  describe('reportPeriod', () => {
    it('gets reportPeriod', () => {
      expect(instance.getReportPeriod()).to.deep.equal(sampleReport.reportPeriod);
    });
  });

  describe('comparisonPeriod', () => {
    it('gets comparisonPeriod', () => {
      expect(instance.getComparisonPeriod()).to.deep.equal(sampleReport.comparisonPeriod);
    });
  });

  describe('storagePath', () => {
    it('gets storagePath', () => {
      expect(instance.getStoragePath()).to.equal(sampleReport.storagePath);
    });
  });

  describe('createdAt', () => {
    it('gets createdAt', () => {
      expect(instance.getCreatedAt()).to.equal(sampleReport.createdAt);
    });
  });

  describe('updatedAt', () => {
    it('gets updatedAt', () => {
      expect(instance.getUpdatedAt()).to.equal(sampleReport.updatedAt);
    });
  });
});
