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
import { hasPermisson } from '../../../src/util/auth.js';

function prepPathForSort(path) {
  if (path.endsWith('/+**')) return path.slice(0, -3);
  if (path.endsWith('/**')) return path.slice(0, -2);
  return path;
}

function pathSorter({ path: path1 }, { path: path2 }) {
  const sp1 = prepPathForSort(path1);
  const sp2 = prepPathForSort(path2);
  return sp2.length - sp1.length;
}

describe('haspermission', () => {
  it('test haspermission no perms', () => {
    const aclCtx = {
      acls: [{
        role: 'not-much-at-all',
      }],
    };
    expect(hasPermisson('/someapi/123', 'R', aclCtx)).to.be.false;
  });

  it('test haspermission multiple roles', () => {
    const aclCtx = {
      acls: [
        {
          role: 'no-perms-role',
          acl: [],
        },
        {
          role: 'role1',
          acl: [
            { path: '/some/where/out/there', actions: ['D'] },
            { path: '/here/where/out/there', actions: ['D'] },
          ],
        },
        {
          role: 'some-admin',
          acl: [{ path: '/some/**', actions: ['C', 'R', 'U'] }],
        },
      ],
    };

    // Matches both role1 and some-admin so get all CRUD
    expect(hasPermisson('/some/where/out/there', 'C', aclCtx)).to.be.true;
    expect(hasPermisson('/some/where/out/there', 'R', aclCtx)).to.be.true;
    expect(hasPermisson('/some/where/out/there', 'U', aclCtx)).to.be.true;
    expect(hasPermisson('/some/where/out/there', 'D', aclCtx)).to.be.true;

    // Matches only some-admin
    expect(hasPermisson('/some/thing', 'C', aclCtx)).to.be.true;
    expect(hasPermisson('/some/thing', 'R', aclCtx)).to.be.true;
    expect(hasPermisson('/some/thing', 'U', aclCtx)).to.be.true;
    expect(hasPermisson('/some/thing', 'D', aclCtx)).to.be.false;

    // Only matches role1
    expect(hasPermisson('/here/where/out/there', 'C', aclCtx)).to.be.false;
    expect(hasPermisson('/here/where/out/there', 'R', aclCtx)).to.be.false;
    expect(hasPermisson('/here/where/out/there', 'U', aclCtx)).to.be.false;
    expect(hasPermisson('/here/where/out/there', 'D', aclCtx)).to.be.true;

    // Matches nothing
    expect(hasPermisson('/something', 'C', aclCtx)).to.be.false;
    expect(hasPermisson('/something', 'R', aclCtx)).to.be.false;
    expect(hasPermisson('/something', 'U', aclCtx)).to.be.false;
    expect(hasPermisson('/something', 'D', aclCtx)).to.be.false;
  });

  it('test haspermission', () => {
    const aclCtx = {
      acls: [
        {
          role: 'some-role',
          acl: [
            { path: '/someapi', actions: ['R'] },
            { path: '/someapi/**', actions: ['C', 'R', 'U', 'D'] },
            { path: '/someapi/specificid', actions: [] },
            { path: '/someapi/someid/*', actions: ['D'] },
            { path: '/someapi/*/myop', actions: ['R'] },
          ],
        },
      ],
    };

    // Ensure the paths are sorted with the longest first
    aclCtx.acls.forEach((a) => a.acl.sort(pathSorter));

    // matching rule: /someapi/**
    expect(hasPermisson('/someapi/xyz123', 'C', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/xyz123', 'R', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/xyz123', 'U', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/xyz123', 'D', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/tes', 'R', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/tes', 'U', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/tes', 'C', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/tes', 'D', aclCtx)).to.be.true;

    // matching rule: /someapi/specificid
    expect(hasPermisson('/someapi/specificid', 'C', aclCtx)).to.be.false;
    expect(hasPermisson('/someapi/specificid', 'R', aclCtx)).to.be.false;
    expect(hasPermisson('/someapi/specificid', 'U', aclCtx)).to.be.false;
    expect(hasPermisson('/someapi/specificid', 'D', aclCtx)).to.be.false;

    // matching rule: /someapi
    expect(hasPermisson('/someapi', 'C', aclCtx)).to.be.false;
    expect(hasPermisson('/someapi', 'R', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi', 'U', aclCtx)).to.be.false;
    expect(hasPermisson('/someapi', 'D', aclCtx)).to.be.false;

    // matching rule: /someapi/*/myop
    expect(hasPermisson('/someapi/specificid/myop', 'C', aclCtx)).to.be.false;
    expect(hasPermisson('/someapi/specificid/myop', 'R', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/specificid/myop', 'U', aclCtx)).to.be.false;
    expect(hasPermisson('/someapi/specificid/myop', 'D', aclCtx)).to.be.false;

    // matching rule: /someapi/*/myop
    expect(hasPermisson('/someapi/999/myop', 'C', aclCtx)).to.be.false;
    expect(hasPermisson('/someapi/999/myop', 'R', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/999/myop', 'U', aclCtx)).to.be.false;
    expect(hasPermisson('/someapi/999/myop', 'D', aclCtx)).to.be.false;

    // matching rule: /someapi/**
    expect(hasPermisson('/someapi/9/9/myop', 'C', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/9/9/myop', 'R', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/9/9/myop', 'U', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/9/9/myop', 'D', aclCtx)).to.be.true;

    // matching rule: /someapi/someid/*
    expect(hasPermisson('/someapi/someid/777', 'C', aclCtx)).to.be.false;
    expect(hasPermisson('/someapi/someid/777', 'R', aclCtx)).to.be.false;
    expect(hasPermisson('/someapi/someid/777', 'U', aclCtx)).to.be.false;
    expect(hasPermisson('/someapi/someid/777', 'D', aclCtx)).to.be.true;

    // matching rule: /someapi/**
    expect(hasPermisson('/someapi/someid/777/someop', 'C', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/someid/777/someop', 'R', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/someid/777/someop', 'U', aclCtx)).to.be.true;
    expect(hasPermisson('/someapi/someid/777/someop', 'D', aclCtx)).to.be.true;
  });
});
