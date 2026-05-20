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

import { expect } from 'chai';
import sinon from 'sinon';

import { findFacsAccessMapping } from '../../src/auth/facs-state-layer.js';

/**
 * Builds a chained PostgREST-style stub. Each `.eq(...)` returns the same
 * builder; the terminal `.maybeSingle()` resolves to `{ data, error }`.
 */
function fakePostgrestClient(result) {
  const builder = {
    select: sinon.stub().returnsThis(),
    eq: sinon.stub().returnsThis(),
    limit: sinon.stub().returnsThis(),
    maybeSingle: sinon.stub().resolves(result),
  };
  return {
    builder,
    from: sinon.stub().returns(builder),
  };
}

describe('findFacsAccessMapping', () => {
  const keys = {
    imsOrgId: 'org-1',
    subjectType: 'user',
    subjectId: 'ABC123@AdobeID',
    facsPermission: 'llmo/can_view',
    resourceType: 'brand',
    resourceId: 'brand-abc',
  };

  it('returns the row when PostgREST resolves data', async () => {
    const client = fakePostgrestClient({ data: { id: 'row-1' }, error: null });
    const out = await findFacsAccessMapping(client, keys);
    expect(out).to.deep.equal({ id: 'row-1' });
    expect(client.from.calledOnceWithExactly('facs_access_mappings')).to.be.true;
  });

  it('returns null when PostgREST resolves data: null', async () => {
    const client = fakePostgrestClient({ data: null, error: null });
    const out = await findFacsAccessMapping(client, keys);
    expect(out).to.equal(null);
  });

  it('returns null when PostgREST resolves data: undefined', async () => {
    const client = fakePostgrestClient({ data: undefined, error: null });
    const out = await findFacsAccessMapping(client, keys);
    expect(out).to.equal(null);
  });

  it('passes every key as an .eq() filter in the expected column-name shape', async () => {
    const client = fakePostgrestClient({ data: null, error: null });
    await findFacsAccessMapping(client, keys);
    const eqCalls = client.builder.eq.getCalls().map((c) => c.args);
    expect(eqCalls).to.deep.equal([
      ['ims_org_id', 'org-1'],
      ['subject_type', 'user'],
      ['subject_id', 'ABC123@AdobeID'],
      ['facs_permission', 'llmo/can_view'],
      ['resource_type', 'brand'],
      ['resource_id', 'brand-abc'],
    ]);
  });

  it('throws with a meaningful message when PostgREST returns an error', async () => {
    const client = fakePostgrestClient({
      data: null,
      error: { message: 'connection refused' },
    });
    try {
      await findFacsAccessMapping(client, keys);
      throw new Error('expected to throw');
    } catch (e) {
      expect(e.message).to.equal('findFacsAccessMapping failed: connection refused');
    }
  });
});
