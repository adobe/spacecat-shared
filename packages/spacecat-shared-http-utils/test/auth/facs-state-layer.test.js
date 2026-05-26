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

import { findFacsResourceBinding, normalizeImsOrgId } from '../../src/auth/facs-state-layer.js';

/**
 * Builds a chained PostgREST-style stub. Each `.eq(...)` / `.is(...)` returns
 * the same builder; the terminal `.maybeSingle()` resolves to `{ data, error }`.
 */
function fakePostgrestClient(result) {
  const builder = {
    select: sinon.stub().returnsThis(),
    eq: sinon.stub().returnsThis(),
    is: sinon.stub().returnsThis(),
    limit: sinon.stub().returnsThis(),
    maybeSingle: sinon.stub().resolves(result),
  };
  return {
    builder,
    from: sinon.stub().returns(builder),
  };
}

describe('findFacsResourceBinding', () => {
  const keys = {
    imsOrgId: 'ACME-ORG@AdobeOrg',
    subjectType: 'user',
    subjectId: 'ABC123@AdobeID',
    resourceType: 'brand',
    resourceId: 'brand-abc',
  };

  it('returns the row when PostgREST resolves data (active binding exists)', async () => {
    const client = fakePostgrestClient({ data: { id: 'row-1' }, error: null });
    const out = await findFacsResourceBinding(client, keys);
    expect(out).to.deep.equal({ id: 'row-1' });
    expect(client.from.calledOnceWithExactly('facs_access_mappings')).to.be.true;
  });

  it('selects only the id column (existence check, no payload)', async () => {
    const client = fakePostgrestClient({ data: { id: 'row-1' }, error: null });
    await findFacsResourceBinding(client, keys);
    expect(client.builder.select.calledOnceWithExactly('id')).to.be.true;
  });

  it('returns null when PostgREST resolves data: null (no active binding)', async () => {
    const client = fakePostgrestClient({ data: null, error: null });
    const out = await findFacsResourceBinding(client, keys);
    expect(out).to.equal(null);
  });

  it('returns null when PostgREST resolves data: undefined', async () => {
    const client = fakePostgrestClient({ data: undefined, error: null });
    const out = await findFacsResourceBinding(client, keys);
    expect(out).to.equal(null);
  });

  it('passes every binding key as an .eq() filter — NO facs_permission column', async () => {
    const client = fakePostgrestClient({ data: null, error: null });
    await findFacsResourceBinding(client, keys);
    const eqCalls = client.builder.eq.getCalls().map((c) => c.args);
    expect(eqCalls).to.deep.equal([
      ['ims_org_id', 'ACME-ORG@AdobeOrg'],
      ['subject_type', 'user'],
      ['subject_id', 'ABC123@AdobeID'],
      ['resource_type', 'brand'],
      ['resource_id', 'brand-abc'],
    ]);
  });

  it('filters on revoked_at IS NULL so tombstones never match', async () => {
    const client = fakePostgrestClient({ data: null, error: null });
    await findFacsResourceBinding(client, keys);
    expect(client.builder.is.calledOnceWithExactly('revoked_at', null)).to.be.true;
  });

  it('throws with a meaningful message when PostgREST returns an error', async () => {
    const client = fakePostgrestClient({
      data: null,
      error: { message: 'connection refused' },
    });
    try {
      await findFacsResourceBinding(client, keys);
      throw new Error('expected to throw');
    } catch (e) {
      expect(e.message).to.equal('findFacsResourceBinding failed: connection refused');
    }
  });
});

describe('normalizeImsOrgId', () => {
  it('appends @AdobeOrg to a bare ident (the common case from getTenantIds()[0])', () => {
    expect(normalizeImsOrgId('ACME-ORG')).to.equal('ACME-ORG@AdobeOrg');
  });

  it('is idempotent on a value already in <ident>@<authSrc> form', () => {
    expect(normalizeImsOrgId('ACME-ORG@AdobeOrg')).to.equal('ACME-ORG@AdobeOrg');
  });

  it('honours an explicit authSrc override', () => {
    expect(normalizeImsOrgId('ACME-ORG', 'AdobeIDInt')).to.equal('ACME-ORG@AdobeIDInt');
  });

  it('does not re-suffix when the input already has any @<authSrc>', () => {
    expect(normalizeImsOrgId('ACME-ORG@AdobeIDInt', 'AdobeOrg')).to.equal('ACME-ORG@AdobeIDInt');
  });

  it('returns null unchanged (callers chain without branching)', () => {
    expect(normalizeImsOrgId(null)).to.equal(null);
  });

  it('returns undefined unchanged', () => {
    expect(normalizeImsOrgId(undefined)).to.equal(undefined);
  });

  it('returns the empty string unchanged (falsy short-circuit)', () => {
    expect(normalizeImsOrgId('')).to.equal('');
  });

  it('returns non-string inputs unchanged (defensive — caller error)', () => {
    expect(normalizeImsOrgId(12345)).to.equal(12345);
  });
});
