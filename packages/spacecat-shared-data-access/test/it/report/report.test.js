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
import chaiAsPromised from 'chai-as-promised';
import { seedDatabase } from '../util/seed.js';
import { getDataAccess } from '../util/db.js';
import reportsFixture from '../../fixtures/reports.fixture.js';

use(chaiAsPromised);

describe('Report IT', () => {
  let dataAccess;
  let Report;

  before(async () => {
    await seedDatabase();
    dataAccess = getDataAccess();
    Report = dataAccess.Report;
  });

  it('should seed reports correctly', async () => {
    // Aggregate all reports by unique siteId
    const uniqueSiteIds = [...new Set(reportsFixture.map((r) => r.siteId))];
    // Fetch all reports for each siteId in parallel
    const reportsArrays = await Promise
      .all(uniqueSiteIds.map((siteId) => Report.allBySiteId(siteId)));
    const allReports = reportsArrays.flat();
    expect(allReports).to.be.an('array');
    expect(allReports.length).to.equal(reportsFixture.length);
    const ids = allReports.map((r) => r.getId());
    for (const fixture of reportsFixture) {
      expect(ids).to.include(fixture.reportId);
    }
  });

  it('should find a report by id', async () => {
    const report = await Report.findById(reportsFixture[0].reportId);
    expect(report).to.exist;
    expect(report.getId()).to.equal(reportsFixture[0].reportId);
    expect(report.getReportType()).to.equal(reportsFixture[0].reportType);
    expect(report.getReportPeriod()).to.deep.equal(reportsFixture[0].reportPeriod);
    expect(report.getComparisonPeriod()).to.deep.equal(reportsFixture[0].comparisonPeriod);
    expect(report.getStoragePath()).to.equal(reportsFixture[0].storagePath);
  });

  it('should find all reports by siteId', async () => {
    const { siteId } = reportsFixture[0];
    const reports = await Report.allBySiteId(siteId);
    expect(reports).to.be.an('array');
    expect(reports.some((r) => r.getId() === reportsFixture[0].reportId)).to.be.true;
  });

  it('should create a new report', async () => {
    // Use a valid UUID for siteId from the fixture
    const newReport = {
      reportId: 'c3d4e5f6-a7b8-9012-cdab-3456789012cd',
      siteId: reportsFixture[0].siteId, // valid UUID
      reportType: 'summary',
      reportPeriod: { startDate: '2025-08-01T09:00:00Z', endDate: '2025-08-31T09:00:00Z' },
      comparisonPeriod: { startDate: '2025-07-01T09:00:00Z', endDate: '2025-07-31T09:00:00Z' },
      storagePath: '/reports/5d6d4439-6659-46c2-b646-92d110fa5a52/summary/c3d4e5f6-a7b8-9012-cdab-3456789012cd/',
    };
    const created = await Report.create(newReport);
    expect(created.getId()).to.equal(newReport.reportId);
    const found = await Report.findById(newReport.reportId);
    expect(found).to.exist;
    expect(found.getReportType()).to.equal('summary');
  });
});
