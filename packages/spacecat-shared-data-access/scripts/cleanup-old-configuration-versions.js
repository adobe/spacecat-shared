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

/* eslint-disable no-console, import/no-named-as-default, max-len */

/**
 * ONE-TIME CLEANUP SCRIPT
 *
 * This script deletes old configuration versions to bring the total count down to 500.
 * It keeps the newest 500 versions and deletes all older versions.
 *
 * ⚠️ WARNING: This script is for ONE-TIME use only and should NEVER be merged to main.
 * Run this script in production BEFORE deploying the automatic version limit feature.
 *
 * Usage:
 *   DRY_RUN=true node scripts/cleanup-old-configuration-versions.js
 *   node scripts/cleanup-old-configuration-versions.js
 *
 * Environment Variables Required:
 *   - DYNAMO_TABLE_NAME: The DynamoDB table name
 *   - AWS_REGION: AWS region (default: us-east-1)
 *   - DRY_RUN: Set to 'true' to preview deletions without executing (optional)
 */

import createDataAccess from '../src/index.js';

const MAX_VERSIONS = 500;
const BATCH_SIZE = 25; // DynamoDB batch write limit

/**
 * Main cleanup function
 */
async function cleanupOldConfigVersions() {
  const isDryRun = process.env.DRY_RUN === 'true';

  console.log('='.repeat(80));
  console.log('Configuration Version Cleanup Script');
  console.log('='.repeat(80));
  console.log(`Mode: ${isDryRun ? 'DRY RUN (preview only)' : 'LIVE DELETION'}`);
  console.log(`Target: Keep ${MAX_VERSIONS} newest versions, delete the rest`);
  console.log(`Table: ${process.env.DYNAMO_TABLE_NAME || 'NOT SET'}`);
  console.log('='.repeat(80));
  console.log('');

  if (!process.env.DYNAMO_TABLE_NAME) {
    console.error('ERROR: DYNAMO_TABLE_NAME environment variable is required');
    process.exit(1);
  }

  let dataAccess;

  try {
    // Initialize data access
    console.log('Initializing data access...');
    dataAccess = createDataAccess({
      log: console,
    });

    const { Configuration } = dataAccess;

    // Query all configuration versions
    console.log('Querying all configuration versions...');
    const allConfigs = await Configuration.all({}, { order: 'desc' });
    console.log(`Found ${allConfigs.length} total configuration versions`);
    console.log('');

    // Check if cleanup is needed
    if (allConfigs.length <= MAX_VERSIONS) {
      console.log(`No cleanup needed. Current count (${allConfigs.length}) is within limit (${MAX_VERSIONS})`);
      process.exit(0);
    }

    // Calculate versions to delete
    const versionsToDelete = allConfigs.slice(MAX_VERSIONS);
    const deleteCount = versionsToDelete.length;
    const batchCount = Math.ceil(deleteCount / BATCH_SIZE);

    console.log('Cleanup Summary:');
    console.log(`   Current versions: ${allConfigs.length}`);
    console.log(`   Target versions:  ${MAX_VERSIONS}`);
    console.log(`   To delete:        ${deleteCount}`);
    console.log(`   Batch size:       ${BATCH_SIZE}`);
    console.log(`   Total batches:    ${batchCount}`);
    console.log('');

    // Show sample of versions to be deleted
    console.log('Sample of versions to be deleted (oldest first):');
    const sampleCount = Math.min(10, versionsToDelete.length);
    versionsToDelete.slice(-sampleCount).reverse().forEach((config, index) => {
      console.log(`   ${index + 1}. Version ${config.getVersion()} - Created: ${config.getCreatedAt()}`);
    });
    if (versionsToDelete.length > sampleCount) {
      console.log(`   ... and ${versionsToDelete.length - sampleCount} more versions`);
    }
    console.log('');

    // Show sample of versions to be kept
    console.log('Sample of versions to be kept (newest first):');
    const keepSample = Math.min(5, MAX_VERSIONS);
    allConfigs.slice(0, keepSample).forEach((config, index) => {
      console.log(`   ${index + 1}. Version ${config.getVersion()} - Created: ${config.getCreatedAt()}`);
    });
    console.log(`   ... and ${MAX_VERSIONS - keepSample} more versions`);
    console.log('');

    if (isDryRun) {
      console.log('🔍 DRY RUN MODE: No deletions will be performed');
      console.log('   Set DRY_RUN=false or remove it to actually delete versions');
      process.exit(0);
    }

    // Confirm before deletion
    console.log('WARNING: About to delete configuration versions!');
    console.log('   This operation cannot be undone.');
    console.log('   Press Ctrl+C within 10 seconds to cancel...');
    console.log('');

    await new Promise((resolve) => {
      setTimeout(resolve, 10000);
    });

    // Delete in batches
    console.log('Starting deletion process...');
    console.log('');

    for (let i = 0; i < versionsToDelete.length; i += BATCH_SIZE) {
      const batch = versionsToDelete.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const ids = batch.map((config) => config.getId());

      console.log(`   Batch ${batchNumber}/${batchCount}: Deleting ${ids.length} versions...`);

      try {
        // eslint-disable-next-line no-await-in-loop
        await Configuration.removeByIds(ids);
        console.log(` Batch ${batchNumber} deleted successfully`);
      } catch (error) {
        console.error(`   Batch ${batchNumber} failed:`, error.message);
        throw error; // Stop on first failure
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('CLEANUP COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log(`   Deleted: ${deleteCount} versions`);
    console.log(`   Remaining: ${MAX_VERSIONS} versions`);
    console.log('');
  } catch (error) {
    console.error('');
    console.error('='.repeat(80));
    console.error('CLEANUP FAILED');
    console.error('='.repeat(80));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('');
    process.exit(1);
  }
}

// Run the cleanup
cleanupOldConfigVersions();
