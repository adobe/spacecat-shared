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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { validate as uuidValidate } from 'uuid';

import fixtures from '../../fixtures/index.fixtures.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import { sanitizeTimestamps } from '../../../src/util/util.js';

use(chaiAsPromised);

function checkReport(report) {
  expect(report).to.be.an('object');
  expect(report.getId()).to.be.a('string');
  expect(report.getReportType()).to.be.a('string');
  expect(report.getSiteId()).to.be.a('string');
  expect(report.getReportPeriod()).to.be.an('object');
  expect(report.getComparisonPeriod()).to.be.an('object');
  expect(report.getStoragePath()).to.be.a('string');
  expect(report.getStatus()).to.be.a('string');
  expect(['processing', 'success', 'failed']).to.include(report.getStatus());
  expect(report.getCreatedAt()).to.be.a('string');
  expect(report.getUpdatedAt()).to.be.a('string');
  expect(report.getUpdatedBy()).to.be.a('string');
}

describe('Report IT', async () => {
  const { siteId } = fixtures.sites[0];
  let sampleData;
  let Report;

  before(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    Report = dataAccess.Report;
  });

  it('finds one report by ID', async () => {
    const sample = sampleData.reports[0];

    const report = await Report.findById(sample.getId());

    checkReport(report);

    expect(
      sanitizeTimestamps(report.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sample.toJSON()),
    );
  });

  it('returns null when report is not found by ID', async () => {
    const report = await Report.findById('00000000-0000-0000-0000-000000000000');

    expect(report).to.be.null;
  });

  it('finds all reports by site ID', async () => {
    const sample = sampleData.reports[0];
    const testSiteId = sample.getSiteId();

    const reports = await Report.allBySiteId(testSiteId);

    expect(reports).to.be.an('array');
    expect(reports.length).to.be.greaterThan(0);

    for (const report of reports) {
      checkReport(report);
      expect(report.getSiteId()).to.equal(testSiteId);
    }
  });

  it('finds single report by site ID', async () => {
    const sample = sampleData.reports[0];
    const testSiteId = sample.getSiteId();

    const report = await Report.findBySiteId(testSiteId);

    expect(report).to.not.be.null;
    checkReport(report);
    expect(report.getSiteId()).to.equal(testSiteId);
  });

  it('finds all reports by report type', async () => {
    const sample = sampleData.reports[0];
    const testReportType = sample.getReportType();

    const reports = await Report.allByReportType(testReportType);

    expect(reports).to.be.an('array');
    expect(reports.length).to.be.greaterThan(0);

    for (const report of reports) {
      checkReport(report);
      expect(report.getReportType()).to.equal(testReportType);
    }
  });

  it('finds single report by report type', async () => {
    const sample = sampleData.reports[0];
    const testReportType = sample.getReportType();

    const report = await Report.findByReportType(testReportType);

    expect(report).to.not.be.null;
    checkReport(report);
    expect(report.getReportType()).to.equal(testReportType);
  });

  it('adds a new report', async () => {
    const data = {
      siteId,
      reportType: 'summary',
      reportPeriod: {
        startDate: '2025-08-01T09:00:00Z',
        endDate: '2025-08-31T09:00:00Z',
      },
      comparisonPeriod: {
        startDate: '2025-07-01T09:00:00Z',
        endDate: '2025-07-31T09:00:00Z',
      },
    };

    const report = await Report.create(data);

    checkReport(report);

    expect(uuidValidate(report.getId())).to.be.true;
    expect(report.getSiteId()).to.equal(data.siteId);
    expect(report.getReportType()).to.equal(data.reportType);
    expect(report.getReportPeriod()).to.deep.equal(data.reportPeriod);
    expect(report.getComparisonPeriod()).to.deep.equal(data.comparisonPeriod);

    // Storage path should be auto-computed with the generated reportId
    const expectedStoragePath = `/reports/${siteId}/summary/${report.getId()}/`;
    expect(report.getStoragePath()).to.equal(expectedStoragePath);

    const record = report.toJSON();
    delete record.reportId;
    delete record.createdAt;
    delete record.updatedAt;
    delete record.updatedBy;
    // The storagePath in the record will include the auto-generated reportId
    const expectedRecord = { ...data };
    expectedRecord.storagePath = `/reports/${siteId}/summary/${report.getId()}/`;
    expectedRecord.status = 'processing'; // Default status for new reports
    expect(record).to.eql(expectedRecord);
  });

  it('adds a new report with custom storage path', async () => {
    const data = {
      siteId,
      reportType: 'custom',
      reportPeriod: {
        startDate: '2025-08-01T09:00:00Z',
        endDate: '2025-08-31T09:00:00Z',
      },
      comparisonPeriod: {
        startDate: '2025-07-01T09:00:00Z',
        endDate: '2025-07-31T09:00:00Z',
      },
      storagePath: '/custom/reports/path/',
    };

    const report = await Report.create(data);

    checkReport(report);

    expect(uuidValidate(report.getId())).to.be.true;
    expect(report.getSiteId()).to.equal(data.siteId);
    expect(report.getReportType()).to.equal(data.reportType);
    expect(report.getReportPeriod()).to.deep.equal(data.reportPeriod);
    expect(report.getComparisonPeriod()).to.deep.equal(data.comparisonPeriod);
    expect(report.getStoragePath()).to.equal(data.storagePath);

    const record = report.toJSON();
    delete record.reportId;
    delete record.createdAt;
    delete record.updatedAt;
    delete record.updatedBy;

    const expectedRecord = { ...data };
    expectedRecord.status = 'processing'; // Default status for new reports
    expect(record).to.eql(expectedRecord);
  });

  it('adds a new report with empty storage path (auto-computed)', async () => {
    const data = {
      siteId,
      reportType: 'auto-computed',
      reportPeriod: {
        startDate: '2025-08-01T09:00:00Z',
        endDate: '2025-08-31T09:00:00Z',
      },
      comparisonPeriod: {
        startDate: '2025-07-01T09:00:00Z',
        endDate: '2025-07-31T09:00:00Z',
      },
      storagePath: '', // Explicitly set to empty string
    };

    const report = await Report.create(data);

    checkReport(report);

    expect(uuidValidate(report.getId())).to.be.true;
    expect(report.getSiteId()).to.equal(data.siteId);
    expect(report.getReportType()).to.equal(data.reportType);
    expect(report.getReportPeriod()).to.deep.equal(data.reportPeriod);
    expect(report.getComparisonPeriod()).to.deep.equal(data.comparisonPeriod);

    // Storage path should be auto-computed since it was empty
    const expectedStoragePath = `/reports/${siteId}/auto-computed/${report.getId()}/`;
    expect(report.getStoragePath()).to.equal(expectedStoragePath);
  });

  it('updates a report', async () => {
    const sample = sampleData.reports[0];
    const updates = {
      reportType: 'updated-type',
      reportPeriod: {
        startDate: '2025-09-01T09:00:00Z',
        endDate: '2025-09-30T09:00:00Z',
      },
      comparisonPeriod: {
        startDate: '2025-08-01T09:00:00Z',
        endDate: '2025-08-31T09:00:00Z',
      },
      storagePath: '/reports/updated/path/',
      updatedBy: 'test-user',
    };

    const report = await Report.findById(sample.getId());

    report.setReportType(updates.reportType);
    report.setReportPeriod(updates.reportPeriod);
    report.setComparisonPeriod(updates.comparisonPeriod);
    report.setStoragePath(updates.storagePath);
    report.setUpdatedBy(updates.updatedBy);

    await report.save();

    checkReport(report);

    expect(report.getReportType()).to.equal(updates.reportType);
    expect(report.getReportPeriod()).to.deep.equal(updates.reportPeriod);
    expect(report.getComparisonPeriod()).to.deep.equal(updates.comparisonPeriod);
    expect(report.getStoragePath()).to.equal(updates.storagePath);
    expect(report.getUpdatedBy()).to.equal(updates.updatedBy);
  });
});
