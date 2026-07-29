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

import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import nock from 'nock';
import { resolveRumDomainKey } from '../src/rum-domain-key.js';
import RUMAPIClient, { RUM_BUNDLER_API_HOST } from '../src/client.js';

use(sinonChai);

const ADMIN_KEY = 'test-admin-key';

function mockDomainkey(domain, key) {
  nock(RUM_BUNDLER_API_HOST)
    .get(`/domainkey/${domain}`)
    .reply(200, { domainkey: key });
}

function mockDomainkeyFail(domain, status = 404) {
  nock(RUM_BUNDLER_API_HOST)
    .get(`/domainkey/${domain}`)
    .reply(status, { error: 'not found' });
}

describe('resolveRumDomainKey', () => {
  const sandbox = sinon.createSandbox();

  let site;
  let siteConfig;
  let context;

  beforeEach(() => {
    sandbox.reset();
    nock.cleanAll();

    siteConfig = {
      getFetchConfig: sandbox.stub().returns({}),
    };

    site = {
      getId: () => 'site-123',
      getBaseURL: () => 'https://example.com',
      getConfig: () => siteConfig,
    };

    // fresh context per test — avoids rumApiClient cache leaking between tests
    context = {
      env: { RUM_ADMIN_KEY: ADMIN_KEY },
      log: { info: sandbox.stub(), warn: sandbox.stub(), error: sandbox.stub() },
    };
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  it('returns hasDomainKey true when base hostname resolves', async () => {
    mockDomainkey('example.com', 'dom-key-abc');

    const result = await resolveRumDomainKey(site, context);

    expect(result).to.deep.equal({ hasDomainKey: true, timedOut: false });
  });

  it('falls back to www variant when bare hostname fails', async () => {
    mockDomainkeyFail('example.com');
    mockDomainkey('www.example.com', 'dom-key-www');

    const result = await resolveRumDomainKey(site, context);

    expect(result).to.deep.equal({ hasDomainKey: true, timedOut: false });
  });

  it('returns hasDomainKey false when all candidates fail', async () => {
    mockDomainkeyFail('example.com');
    mockDomainkeyFail('www.example.com');

    const result = await resolveRumDomainKey(site, context);

    expect(result).to.deep.equal({ hasDomainKey: false, timedOut: false });
    expect(context.log.warn).to.have.been.calledWithMatch(/No domain key found/);
  });

  it('tries overrideBaseURL hostname first when set', async () => {
    siteConfig.getFetchConfig.returns({ overrideBaseURL: 'https://override.example.com' });
    mockDomainkey('override.example.com', 'dom-key-override');

    const result = await resolveRumDomainKey(site, context);

    expect(result).to.deep.equal({ hasDomainKey: true, timedOut: false });
    expect(nock.isDone()).to.be.true;
  });

  it('tries all four candidates in order', async () => {
    siteConfig.getFetchConfig.returns({ overrideBaseURL: 'https://override.example.com' });
    mockDomainkeyFail('override.example.com');
    mockDomainkeyFail('www.override.example.com');
    mockDomainkeyFail('example.com');
    mockDomainkey('www.example.com', 'dom-key-www');

    const result = await resolveRumDomainKey(site, context);

    expect(result).to.deep.equal({ hasDomainKey: true, timedOut: false });
    expect(nock.isDone()).to.be.true;
  });

  it('does not add duplicate www when baseURL already starts with www', async () => {
    site = { ...site, getBaseURL: () => 'https://www.example.com' };
    mockDomainkey('www.example.com', 'dom-key-www');

    const result = await resolveRumDomainKey(site, context);

    expect(result).to.deep.equal({ hasDomainKey: true, timedOut: false });
    expect(nock.isDone()).to.be.true;
    // only one nock was registered and consumed — no bare example.com was tried
  });

  it('does not add duplicate www when overrideBaseURL already starts with www', async () => {
    siteConfig.getFetchConfig.returns({ overrideBaseURL: 'https://www.override.example.com' });
    // register only one nock — if a duplicate were attempted it would fail
    nock(RUM_BUNDLER_API_HOST)
      .get('/domainkey/www.override.example.com')
      .once()
      .reply(200, { domainkey: 'dom-key' });
    mockDomainkeyFail('example.com');
    mockDomainkeyFail('www.example.com');

    const result = await resolveRumDomainKey(site, context);

    expect(result).to.deep.equal({ hasDomainKey: true, timedOut: false });
  });

  it('falls back to baseURL when overrideBaseURL is malformed', async () => {
    siteConfig.getFetchConfig.returns({ overrideBaseURL: 'not-a-url' });
    mockDomainkey('example.com', 'dom-key-abc');

    const result = await resolveRumDomainKey(site, context);

    expect(result.hasDomainKey).to.be.true;
    expect(context.log.warn).to.have.been.calledWithMatch(/Malformed overrideBaseURL/);
  });

  it('returns hasDomainKey false and timedOut false when baseURL is malformed', async () => {
    site = { ...site, getBaseURL: () => 'not-a-url' };

    const result = await resolveRumDomainKey(site, context);

    expect(result).to.deep.equal({ hasDomainKey: false, timedOut: false });
    expect(context.log.error).to.have.been.calledWithMatch(/Malformed baseURL/);
  });

  it('returns timedOut true and hasDomainKey false when timeout fires', async () => {
    const retrieveDomainkeyStub = sinon.stub().returns(new Promise(() => {}));
    sinon.stub(RUMAPIClient, 'createFrom').returns({ retrieveDomainkey: retrieveDomainkeyStub });

    try {
      const clock = sinon.useFakeTimers();
      const promise = resolveRumDomainKey(site, context);
      await clock.tickAsync(4000);
      const result = await promise;
      clock.restore();

      expect(result).to.deep.equal({ hasDomainKey: false, timedOut: true });
      expect(context.log.warn).to.have.been.calledWithMatch(/timed out/);
    } finally {
      RUMAPIClient.createFrom.restore();
    }
  });

  it('stops iterating candidates once cancelled by timeout', async () => {
    let rejectFirst;
    const retrieveDomainkeyStub = sinon.stub();
    retrieveDomainkeyStub.withArgs('example.com').returns(
      new Promise((_, reject) => { rejectFirst = reject; }),
    );
    retrieveDomainkeyStub.withArgs('www.example.com').resolves('dom-key-www');
    sinon.stub(RUMAPIClient, 'createFrom').returns({ retrieveDomainkey: retrieveDomainkeyStub });

    try {
      const clock = sinon.useFakeTimers();
      const promise = resolveRumDomainKey(site, context);

      await clock.tickAsync(4000); // timeout fires, cancelled=true
      clock.restore();

      rejectFirst(new Error('slow network'));
      await new Promise(setImmediate); // drain microtasks so inner IIFE checks cancelled

      const result = await promise;

      expect(result.timedOut).to.be.true;
      expect(retrieveDomainkeyStub).to.have.been.calledOnce;
      expect(retrieveDomainkeyStub).not.to.have.been.calledWith('www.example.com');
    } finally {
      RUMAPIClient.createFrom.restore();
    }
  });
});
