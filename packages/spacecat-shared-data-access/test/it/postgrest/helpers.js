/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { createDataAccess } from '../../../src/service/index.js';
import { POSTGREST_WRITER_JWT } from '../util/postgrest-jwt.js';

export const TEST_IDS = {
  organizationId: '04f63783-3f76-4076-bbda-71a11145303c',
  projectId: '6fc3365d-f400-4a17-91e9-7141e5b82350',
  siteId: '0983c6da-0dee-45cc-b897-3f1fed6b460b',
  siteIdSecondary: 'e12c091c-075b-4c94-aab7-398a04412b5c',
  auditId: '74a041ed-a15c-4bdc-a38c-5203b22d2ab3',
};

export const TEST_VALUES = {
  siteBaseURL: 'https://tenant-alphaland.com',
  projectName: 'tenant-alphaland.com',
  csPreviewURL: 'https://author-p50513-e440257.adobeaemcloud.com',
};

export const createLogger = () => ({
  info: () => {},
  debug: () => {},
  error: () => {},
  warn: () => {},
  trace: () => {},
});

export const createITDataAccess = () => {
  const postgrestUrl = process.env.POSTGREST_URL || 'http://127.0.0.1:3300';
  const postgrestApiKey = process.env.POSTGREST_API_KEY || POSTGREST_WRITER_JWT;
  return createDataAccess({ postgrestUrl, postgrestApiKey }, createLogger());
};
