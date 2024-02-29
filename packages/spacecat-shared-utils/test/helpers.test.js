/*
 * Copyright 2023 Adobe. All rights reserved.
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
import { createSite } from '@adobe/spacecat-shared-data-access/src/models/site.js';
import { createOrganization } from '@adobe/spacecat-shared-data-access/src/models/organization.js';
import { AUDIT_TYPE_BROKEN_BACKLINKS } from '@adobe/spacecat-shared-data-access/src/models/audit.js';

import { isAuditsDisabled, resolveSecretsName } from '../src/helpers.js';

describe('resolveSecretsName', () => {
  it('resolves name correctly with valid inputs', () => {
    const ctx = { func: { version: '1.0.0' } };
    const defaultPath = 'secretPath';
    expect(resolveSecretsName({}, ctx, defaultPath)).to.equal('secretPath/1.0.0');
  });

  it('resolves name correctly with valid ci inputs', () => {
    const ctx = { func: { version: 'ci123' } };
    const defaultPath = 'secretPath';
    expect(resolveSecretsName({}, ctx, defaultPath)).to.equal('secretPath/ci');
  });

  it('throws error when ctx is undefined', () => {
    expect(() => resolveSecretsName({}, undefined, 'defaultPath')).to.throw('Invalid context: func.version is required and must be a string');
  });

  it('throws error when ctx.func is undefined', () => {
    const ctx = {};
    expect(() => resolveSecretsName({}, ctx, 'defaultPath')).to.throw('Invalid context: func.version is required and must be a string');
  });

  it('throws error when ctx.func.version is not a string', () => {
    const ctx = { func: { version: null } };
    expect(() => resolveSecretsName({}, ctx, 'defaultPath')).to.throw('Invalid context: func.version is required and must be a string');
  });

  it('throws error when defaultPath is not a string', () => {
    const ctx = { func: { version: '1.0.0' } };
    expect(() => resolveSecretsName({}, ctx, null)).to.throw('Invalid defaultPath: must be a string');
  });
});

describe('isAuditsDisabled', () => {
  it('audits are not disabled if no audit configs', () => {
    const site = createSite({
      id: 'site-1',
      baseURL: 'http://site-1.com',
      organizationId: 'org-1',
    });

    const org = createOrganization({
      id: 'org-1',
      name: 'some-org',
    });

    expect(isAuditsDisabled(site, org)).to.be.false;
  });

  it('audits are not disabled if no audit config for audit type', () => {
    const site = createSite({
      id: 'site-1',
      baseURL: 'http://site-1.com',
      organizationId: 'org-1',
    });

    const org = createOrganization({
      id: 'org-1',
      name: 'some-org',
    });

    const auditType = 'some-audit-type';

    expect(isAuditsDisabled(site, org, auditType)).to.be.false;
  });

  it('audits are disabled if all audits disabled at org level', () => {
    const site = createSite({
      id: 'site-1',
      baseURL: 'http://site-1.com',
      organizationId: 'org-1',
    });

    const org = createOrganization({
      id: 'org-1',
      name: 'some-org',
      config: {
        audits: {
          auditsDisabled: true,
        },
      },
    });

    const auditType = 'some-audit-type';

    expect(isAuditsDisabled(site, org, auditType)).to.be.true;
  });

  it('audits are disabled if all audits disabled at site level', () => {
    const site = createSite({
      id: 'site-1',
      baseURL: 'http://site-1.com',
      organizationId: 'org-1',
      auditConfig: {
        auditsDisabled: true,
      },
    });

    const org = createOrganization({
      id: 'org-1',
      name: 'some-org',
    });

    const auditType = 'some-audit-type';

    expect(isAuditsDisabled(site, org, auditType)).to.be.true;
  });

  it('audits are disabled if all the audit type disabled at org level', () => {
    const auditType = 'some-audit-type';

    const site = createSite({
      id: 'site-1',
      baseURL: 'http://site-1.com',
      organizationId: 'org-1',
    });

    const org = createOrganization({
      id: 'org-1',
      name: 'some-org',
      config: {
        audits: {
          auditsDisabled: false,
          auditTypeConfigs: {
            [auditType]: {
              disabled: true,
            },
          },
        },
      },
    });

    expect(isAuditsDisabled(site, org, auditType)).to.be.true;
  });

  it('audits are disabled if all the audit type disabled at site level', () => {
    const auditType = 'some-audit-type';

    const site = createSite({
      id: 'site-1',
      baseURL: 'http://site-1.com',
      organizationId: 'org-1',
      auditConfig: {
        auditsDisabled: false,
        auditTypeConfigs: {
          [auditType]: {
            disabled: true,
          },
        },
      },
    });

    const org = createOrganization({
      id: 'org-1',
      name: 'some-org',
    });

    expect(isAuditsDisabled(site, org, auditType)).to.be.true;
  });

  it('audits are disabled if the audit type is disabled by default', () => {
    const site = createSite({
      id: 'site-1',
      baseURL: 'http://site-1.com',
      organizationId: 'org-1',
    });

    const org = createOrganization({
      id: 'org-1',
      name: 'some-org',
    });

    expect(isAuditsDisabled(site, org, AUDIT_TYPE_BROKEN_BACKLINKS)).to.be.true;
  });
});
