#!/usr/bin/env node
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

/* eslint-disable no-console */
// eslint-disable-next-line import/no-extraneous-dependencies
import RUMAPIClient from '@adobe/spacecat-shared-rum-api-client/src/index.js';
// Configuration
const DOMAIN = 'www.adobe.com';
const RUM_ADMIN_KEY = process.env.RUM_ADMIN_KEY || 'admin:success-studio:81AF59AD-D764-4C15-87D8-839D72F2DAA4';

// Test options
const testOptions = {
  domain: DOMAIN,
  granularity: 'DAILY',
  startTime: '2025-07-27',
  endTime: '2025-08-27',
  urls: [
    'https://www.adobe.com/',
    'https://www.adobe.com/in/creativecloud.html',
  ],
};

async function testOptimizationHandlers() {
  console.log('🚀 Starting RUM API Client test for adobe.com...\n');

  // Check if admin key is available
  if (!RUM_ADMIN_KEY) {
    console.error('❌ RUM_ADMIN_KEY environment variable is required!');
    console.log('Please set it with: export RUM_ADMIN_KEY="your-admin-key"');
    process.exit(1);
  }

  try {
    // Create RUM API client
    const context = { env: { RUM_ADMIN_KEY } };
    const rumApiClient = RUMAPIClient.createFrom(context);
    console.log('RUM Client started');
    const metricsResult = await rumApiClient.query('optimization-report-metrics', testOptions);
    console.log(JSON.stringify(metricsResult));
    process.exit(1);
  } catch (err) {
    console.log(err);
  }
}

// Run the test
testOptimizationHandlers().catch(console.error);
