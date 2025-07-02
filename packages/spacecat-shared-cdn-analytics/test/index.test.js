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

import { expect } from 'chai';
import * as cdnAnalytics from '../src/index.js';

describe('index', () => {
  it('exports CdnAnalyticsService', () => {
    expect(cdnAnalytics).to.have.property('CdnAnalyticsService');
    expect(cdnAnalytics.CdnAnalyticsService).to.be.a('function');
  });

  it('exports utility functions', () => {
    expect(cdnAnalytics).to.have.property('getS3Config');
    expect(cdnAnalytics.getS3Config).to.be.a('function');

    expect(cdnAnalytics).to.have.property('loadSql');
    expect(cdnAnalytics.loadSql).to.be.a('function');

    expect(cdnAnalytics).to.have.property('formatDateString');
    expect(cdnAnalytics.formatDateString).to.be.a('function');

    expect(cdnAnalytics).to.have.property('getWeekRange');
    expect(cdnAnalytics.getWeekRange).to.be.a('function');

    expect(cdnAnalytics).to.have.property('createDateRange');
    expect(cdnAnalytics.createDateRange).to.be.a('function');

    expect(cdnAnalytics).to.have.property('generateReportingPeriods');
    expect(cdnAnalytics.generateReportingPeriods).to.be.a('function');

    expect(cdnAnalytics).to.have.property('validateCountryCode');
    expect(cdnAnalytics.validateCountryCode).to.be.a('function');
  });

  it('exports constants', () => {
    expect(cdnAnalytics).to.have.property('USER_AGENT_PATTERNS');
    expect(cdnAnalytics.USER_AGENT_PATTERNS).to.be.an('object');

    expect(cdnAnalytics).to.have.property('COUNTRY_PATTERNS');
    expect(cdnAnalytics.COUNTRY_PATTERNS).to.be.an('array');

    expect(cdnAnalytics).to.have.property('PAGE_PATTERNS');
    expect(cdnAnalytics.PAGE_PATTERNS).to.be.an('array');
  });

  it('provides working service instantiation', () => {
    const context = {
      log: {
        info: () => {}, error: () => {}, warn: () => {}, debug: () => {},
      },
      env: { AWS_REGION: 'us-east-1' },
    };

    const site = {
      getBaseURL: () => 'https://example.com',
      getConfig: () => ({
        getCdnLogsConfig: () => ({ bucketName: 'test-bucket' }),
      }),
    };

    const service = new cdnAnalytics.CdnAnalyticsService(context, site);
    expect(service).to.be.instanceOf(cdnAnalytics.CdnAnalyticsService);
    expect(service.context).to.equal(context);
    expect(service.site).to.equal(site);
  });
});
