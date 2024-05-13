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
import { promises as fs } from 'fs';

import SpaceCatSdk from '../src/sdk.js';

const log = console;

async function readConfig(configFilePath) {
  try {
    const jsonString = await fs.readFile(configFilePath, 'utf8');
    const config = JSON.parse(jsonString);
    log.info('Config is:', config);
    return config;
  } catch (err) {
    if (err.code === 'ENOENT') {
      log.error('Config file read failed:', err);
      throw new Error('Config file read failed');
    } else {
      log.error('Error parsing config JSON string:', err);
      throw new Error('Error parsing config JSON string');
    }
  }
}

(async () => {
  // Assuming that the file path is the first command line argument
  const configFilePath = process.argv[2];
  const config = await readConfig(configFilePath);
  const {
    imsOrgId,
    orgName,
    siteBaseUrls,
    auditTypes,
    channelId,
    userIds,
    configureAudits,
    enableAudits,
    auditsByOrg,
    configureReports,
    reportsByOrg,
    apiBaseUrl,
    apiKey,
    orgId,
  } = config;

  const sdk = new SpaceCatSdk({ apiBaseUrl, apiKey });

  let organization;
  if (orgId) {
    organization = await sdk.getOrganizationById(orgId, { nullFor404: true });
  } else {
    organization = await sdk.createOrRetrieveOrganization({ imsOrgId, orgName });
  }
  if (!organization) {
    log.error('Failed to create or retrieve organization');
    return;
  }

  if (configureAudits && auditsByOrg) {
    await sdk.configureAuditsForOrganization({ organization, auditTypes, enable: enableAudits });
  }

  if (configureReports) {
    if (reportsByOrg) {
      await sdk.enableReportsAtOrganizationLevel({
        organization, auditTypes, byOrg: true, channelId, userIds,
      });
    } else {
      await sdk.enableReportsAtOrganizationLevel({ organization, auditTypes, byOrg: false });
    }
  }

  await Promise.all(siteBaseUrls.map(async (siteBaseUrl) => {
    const site = await sdk.createOrRetrieveSite({ orgId: organization.id, siteBaseUrl });
    if (!site) {
      log.error('Failed to create or retrieve site');
      return;
    }

    if (configureAudits) {
      await sdk.configureAuditsForSite({ site, auditTypes, enable: enableAudits });
    }

    if (configureReports) {
      if (!reportsByOrg) {
        await sdk.enableReportsAtSiteLevel({
          site, auditTypes, channelId, userIds, byOrg: false,
        });
      }
    }
  }));
  process.exit(0);
})();
