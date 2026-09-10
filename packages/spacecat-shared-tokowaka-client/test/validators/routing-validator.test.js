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
import esmock from 'esmock';

use(sinonChai);

describe('RoutingValidator', () => {
  let sandbox;
  let fetchStub;
  let RoutingValidator;
  let ROUTING_VALIDATOR_TYPE;
  let validator;
  let log;

  const mkSuggestion = (url) => ({ getData: () => ({ url }) });

  const mkResponse = (status, headers = {}) => ({
    status,
    headers: {
      has: (name) => Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase()),
      get: (name) => {
        const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
      },
    },
    body: { cancel: sinon.stub().resolves() },
  });

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    fetchStub = sandbox.stub();
    sandbox.stub(global, 'setTimeout').callsFake((fn) => {
      fn();
      return 0;
    });

    ({ default: RoutingValidator, ROUTING_VALIDATOR_TYPE } = await esmock(
      '../../src/validators/routing-validator.js',
      {
        '@adobe/spacecat-shared-utils': {
          tracingFetch: fetchStub,
          SPACECAT_USER_AGENT: 'Spacecat/1.0',
        },
      },
    ));

    log = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      debug: sandbox.stub(),
    };
    validator = new RoutingValidator(log);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('getType() returns "routing"', () => {
    expect(validator.getType()).to.equal(ROUTING_VALIDATOR_TYPE);
    expect(validator.getType()).to.equal('routing');
  });

  it('returns unknown with reason missing_url when the suggestion has no url', async () => {
    const result = await validator.validate(mkSuggestion(undefined), {});
    expect(result).to.deep.equal({ outcome: 'unknown', metadata: { reason: 'missing_url' } });
    expect(fetchStub).to.not.have.been.called;
  });

  it('returns unknown with reason disallowed_url for a non-https url', async () => {
    const result = await validator.validate(mkSuggestion('http://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'unknown', metadata: { reason: 'disallowed_url' } });
    expect(fetchStub).to.not.have.been.called;
  });

  it('returns unknown with reason disallowed_url for an unparseable url', async () => {
    const result = await validator.validate(mkSuggestion('not-a-url'), {});
    expect(result).to.deep.equal({ outcome: 'unknown', metadata: { reason: 'disallowed_url' } });
  });

  it('returns true when the routing header is present', async () => {
    fetchStub.resolves(mkResponse(200, { 'x-tokowaka-request-id': 'abc' }));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'true', metadata: { origin_status: 200 } });
  });

  it('returns true when the alternate routing header is present', async () => {
    fetchStub.resolves(mkResponse(200, { 'x-edgeoptimize-request-id': 'abc' }));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result.outcome).to.equal('true');
  });

  it('returns unknown for a 404 with no routing header', async () => {
    fetchStub.resolves(mkResponse(404));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'unknown', metadata: { origin_status: 404 } });
  });

  it('returns false for a 200 with no routing header', async () => {
    fetchStub.resolves(mkResponse(200));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'false', metadata: { origin_status: 200 } });
  });

  it('returns false for a 403 with no routing header', async () => {
    fetchStub.resolves(mkResponse(403));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'false', metadata: { origin_status: 403 } });
  });

  it('returns false for a 500 with no routing header', async () => {
    fetchStub.resolves(mkResponse(500));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'false', metadata: { origin_status: 500 } });
  });

  it('classifies correctly even when response.body is not a cancellable stream', async () => {
    // Regression test: a version-mismatched tracingFetch can return a Response whose body
    // isn't a spec-compliant ReadableStream (no .cancel method). cancelBody() must not throw.
    const response = mkResponse(200);
    response.body = {};
    fetchStub.resolves(response);
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'false', metadata: { origin_status: 200 } });
  });

  it('follows a www-normalization redirect and classifies the second response', async () => {
    fetchStub.onCall(0).resolves(mkResponse(301, { location: 'https://www.example.com/a' }));
    fetchStub.onCall(1).resolves(mkResponse(200, { 'x-tokowaka-request-id': 'abc' }));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'true', metadata: { origin_status: 200 } });
    expect(fetchStub).to.have.been.calledTwice;
  });

  it('follows a www-normalization redirect at the root path', async () => {
    fetchStub.onCall(0).resolves(mkResponse(301, { location: 'https://www.example.com/' }));
    fetchStub.onCall(1).resolves(mkResponse(200, { 'x-tokowaka-request-id': 'abc' }));
    const result = await validator.validate(mkSuggestion('https://example.com'), {});
    expect(result).to.deep.equal({ outcome: 'true', metadata: { origin_status: 200 } });
    expect(fetchStub).to.have.been.calledTwice;
  });

  it('follows a www-normalization redirect that also adds a trailing slash', async () => {
    fetchStub.onCall(0).resolves(mkResponse(301, { location: 'https://www.example.com/a/' }));
    fetchStub.onCall(1).resolves(mkResponse(200, { 'x-tokowaka-request-id': 'abc' }));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'true', metadata: { origin_status: 200 } });
    expect(fetchStub).to.have.been.calledTwice;
  });

  it('does not follow a non-www-normalization redirect (different path)', async () => {
    fetchStub.resolves(mkResponse(302, { location: 'https://example.com/b' }));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'unknown', metadata: { origin_status: 302 } });
    expect(fetchStub).to.have.been.calledOnce;
  });

  it('treats a redirect with no location header as unknown', async () => {
    fetchStub.resolves(mkResponse(302));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'unknown', metadata: { origin_status: 302 } });
  });

  it('does not follow a redirect that downgrades https to http even for a www-normalization hostname swap', async () => {
    fetchStub.resolves(mkResponse(301, { location: 'http://www.example.com/a' }));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'unknown', metadata: { origin_status: 301 } });
    expect(fetchStub).to.have.been.calledOnce;
  });

  it('treats a redirect to an unparseable location as unknown', async () => {
    fetchStub.resolves(mkResponse(302, { location: '::not a url::' }));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'unknown', metadata: { origin_status: 302 } });
  });

  it('treats a second consecutive redirect as unknown (does not follow twice)', async () => {
    fetchStub.onCall(0).resolves(mkResponse(301, { location: 'https://www.example.com/a' }));
    fetchStub.onCall(1).resolves(mkResponse(302, { location: 'https://www.example.com/b' }));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'unknown', metadata: { origin_status: 302 } });
    expect(fetchStub).to.have.been.calledTwice;
  });

  it('recovers after a network error on the first attempt', async () => {
    fetchStub.onCall(0).rejects(new Error('network blip'));
    fetchStub.onCall(1).resolves(mkResponse(200, { 'x-tokowaka-request-id': 'abc' }));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({ outcome: 'true', metadata: { origin_status: 200 } });
    expect(global.setTimeout).to.have.been.calledOnce;
    expect(global.setTimeout.firstCall.args[1]).to.equal(4000);
    expect(log.warn).to.have.been.calledOnceWith(
      '[routing-validator] attempt 1/3 failed for https://example.com/a',
      { error: 'network blip' },
    );
  });

  it('returns false with reason network_error and the last error after exhausting all 3 attempts', async () => {
    fetchStub.onCall(0).rejects(new Error('down 1'));
    fetchStub.onCall(1).rejects(new Error('down 2'));
    fetchStub.onCall(2).rejects(new Error('down 3'));
    const result = await validator.validate(mkSuggestion('https://example.com/a'), {});
    expect(result).to.deep.equal({
      outcome: 'false',
      metadata: { reason: 'network_error', lastError: 'down 3', attempts: 3 },
    });
    expect(fetchStub.callCount).to.equal(3);
    expect(global.setTimeout.getCall(0).args[1]).to.equal(4000);
    expect(global.setTimeout.getCall(1).args[1]).to.equal(8000);
    expect(log.warn.callCount).to.equal(3);
    expect(log.warn.thirdCall).to.have.been.calledWith(
      '[routing-validator] attempt 3/3 failed for https://example.com/a',
      { error: 'down 3' },
    );
  });
});
