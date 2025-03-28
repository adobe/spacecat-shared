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

import { expect } from 'chai';

import EntityRegistry from '../../../../src/models/base/entity.registry.js';
import SiteCandidate from '../../../../src/models/site-candidate/site-candidate.model.js';
import schema from '../../../../src/models/site-candidate/site-candidate.schema.js';

describe('SiteCandidateModel', () => {
  function getAclCtx() {
    return {
      acls: [],
      aclEntities: {},
    };
  }

  it('objects that are owned by objects more than 1 level deep', () => {
    // Currently these objects are not protected by ACLs
    const mockLog = {
      debug() {},
      info() {},
    };
    const es = { entities: { siteCandidate: { model: { schema } } } };
    const er = new EntityRegistry(es, { aclCtx: getAclCtx() }, mockLog);

    const record = {
      siteCandidateId: 's12345',
      siteId: 'site123',
      baseURL: 'https://foo.org',
    };
    const siteCandidate = new SiteCandidate(es, er, schema, record, mockLog);
    expect(siteCandidate.getBaseURL()).to.equal('https://foo.org');
  });
});
