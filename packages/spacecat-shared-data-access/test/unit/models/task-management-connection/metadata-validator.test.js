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

import { expect } from 'chai';
import { validateMetadata } from '../../../../src/models/task-management-connection/metadata-validator.js';

const VALID_CLOUD_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('validateMetadata()', () => {
  describe('jira_cloud', () => {
    it('accepts valid jira_cloud metadata', () => {
      expect(() => validateMetadata('jira_cloud', {
        cloudId: VALID_CLOUD_ID,
        siteName: 'My Jira',
        siteUrl: 'https://my-org.atlassian.net',
      })).not.to.throw();
    });

    it('accepts minimal metadata (cloudId + siteName only)', () => {
      expect(() => validateMetadata('jira_cloud', {
        cloudId: VALID_CLOUD_ID,
        siteName: 'My Jira',
      })).not.to.throw();
    });

    it('rejects missing cloudId', () => {
      expect(() => validateMetadata('jira_cloud', { siteName: 'My Jira' }))
        .to.throw('metadata.cloudId is required');
    });

    it('rejects missing siteName', () => {
      expect(() => validateMetadata('jira_cloud', { cloudId: VALID_CLOUD_ID }))
        .to.throw('metadata.siteName is required');
    });

    it('rejects non-UUID cloudId', () => {
      expect(() => validateMetadata('jira_cloud', { cloudId: 'not-a-uuid', siteName: 'x' }))
        .to.throw('cloudId must be a valid UUID');
    });

    it('rejects siteUrl without https scheme', () => {
      expect(() => validateMetadata('jira_cloud', {
        cloudId: VALID_CLOUD_ID,
        siteName: 'x',
        siteUrl: 'http://insecure.atlassian.net',
      })).to.throw('siteUrl must start with https://');
    });

    it('rejects extra properties', () => {
      expect(() => validateMetadata('jira_cloud', {
        cloudId: VALID_CLOUD_ID,
        siteName: 'x',
        unexpected: 'field',
      })).to.throw('Unexpected metadata properties');
    });
  });

  describe('jira_corp', () => {
    it('accepts valid jira_corp metadata', () => {
      expect(() => validateMetadata('jira_corp', {
        baseUrl: 'https://jira.corp.example.com',
      })).not.to.throw();
    });

    it('rejects missing baseUrl', () => {
      expect(() => validateMetadata('jira_corp', {}))
        .to.throw('metadata.baseUrl is required');
    });

    it('rejects non-https baseUrl', () => {
      expect(() => validateMetadata('jira_corp', { baseUrl: 'http://jira.corp.example.com' }))
        .to.throw('baseUrl must be a valid https:// URI');
    });
  });

  describe('unknown provider', () => {
    it('throws for unknown provider', () => {
      expect(() => validateMetadata('asana', { anything: 'goes' }))
        .to.throw('No metadata schema for provider: asana');
    });
  });
});
