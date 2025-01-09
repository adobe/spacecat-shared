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
import { getDataAccess } from '../test/it/util/db.js';

const migratedDataAccess = await getDataAccess({}, true);
const originalDataAccess = await getDataAccess({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
}, true);
const originalSites = await originalDataAccess.getSites();
const originalOrganizations = await originalDataAccess.getOrganizations();
const originalConfigurations = await originalDataAccess.getConfigurations();
const originalSiteCandidates = await originalDataAccess.getSiteCandidates();
migratedDataAccess.Site.createMany(originalSites);
migratedDataAccess.Organization.createMany(originalOrganizations);
migratedDataAccess.Configuration.createMany(originalConfigurations);
migratedDataAccess.SiteCandidate.createMany(originalSiteCandidates);
