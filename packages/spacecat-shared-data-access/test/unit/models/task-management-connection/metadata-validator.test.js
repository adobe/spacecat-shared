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
    it('accepts minimal metadata (cloudId only)', () => {
      expect(() => validateMetadata('jira_cloud', {
        cloudId: VALID_CLOUD_ID,
      })).not.to.throw();
    });

    it('accepts metadata with optional scopes array', () => {
      expect(() => validateMetadata('jira_cloud', {
        cloudId: VALID_CLOUD_ID,
        scopes: ['read:jira-work', 'write:jira-work'],
      })).not.to.throw();
    });

    it('accepts empty scopes array', () => {
      expect(() => validateMetadata('jira_cloud', {
        cloudId: VALID_CLOUD_ID,
        scopes: [],
      })).not.to.throw();
    });

    it('rejects missing cloudId', () => {
      expect(() => validateMetadata('jira_cloud', {}))
        .to.throw('metadata.cloudId is required');
    });

    it('rejects non-UUID cloudId', () => {
      expect(() => validateMetadata('jira_cloud', { cloudId: 'not-a-uuid' }))
        .to.throw('cloudId must be a valid UUID');
    });

    it('rejects non-array scopes', () => {
      expect(() => validateMetadata('jira_cloud', {
        cloudId: VALID_CLOUD_ID,
        scopes: 'read:jira-work',
      })).to.throw('scopes must be an array of strings');
    });

    it('rejects scopes array with non-string elements', () => {
      expect(() => validateMetadata('jira_cloud', {
        cloudId: VALID_CLOUD_ID,
        scopes: [42],
      })).to.throw('scopes must be an array of strings');
    });

    it('rejects siteName in metadata (must use displayName column)', () => {
      expect(() => validateMetadata('jira_cloud', {
        cloudId: VALID_CLOUD_ID,
        siteName: 'My Jira',
      })).to.throw('Unexpected metadata properties');
    });

    it('rejects siteUrl in metadata (must use instanceUrl column)', () => {
      expect(() => validateMetadata('jira_cloud', {
        cloudId: VALID_CLOUD_ID,
        siteUrl: 'https://my-org.atlassian.net',
      })).to.throw('Unexpected metadata properties');
    });

    it('rejects extra properties', () => {
      expect(() => validateMetadata('jira_cloud', {
        cloudId: VALID_CLOUD_ID,
        unexpected: 'field',
      })).to.throw('Unexpected metadata properties');
    });
  });

  describe('unknown provider', () => {
    it('throws for unknown provider', () => {
      expect(() => validateMetadata('asana', { anything: 'goes' }))
        .to.throw('No metadata schema for provider: asana');
    });
  });
});
