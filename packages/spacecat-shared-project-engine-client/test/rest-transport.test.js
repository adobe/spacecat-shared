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
import { createSerenityProjectEngineTransport } from '../src/rest-transport.js';

const BASE = 'https://pe.example';
const PREFIX = '/enterprise/projects/api';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

const sandbox = sinon.createSandbox();
afterEach(() => sandbox.restore());

const make = (fetch, opts = {}) => createSerenityProjectEngineTransport({
  baseUrl: BASE,
  authToken: 'ims-token',
  // No retries/backoff in tests — every canned response is terminal.
  maxRetries: 0,
  retryBaseDelayMs: 0,
  fetch,
  ...opts,
});

// Fill every `{placeholder}` a path template declares with a stable id, so the
// resolved URL is deterministic and every path param is supplied.
const PARAM_VALUES = {
  id: 'ws-1',
  project_id: 'p-1',
  benchmark_id: 'b-1',
  tag_id: 't-1',
  prompt_id: 'pr-1',
};

const pathParamsFor = (template) => {
  const keys = [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  return Object.fromEntries(keys.map((k) => [k, PARAM_VALUES[k]]));
};

const resolve = (template) => template.replace(/\{(\w+)\}/g, (_, k) => PARAM_VALUES[k]);

// facadeMethod — HTTP method — path template. 1:1 with the 28 operations.
const OPERATIONS = [
  ['listLanguages', 'GET', '/v1/languages'],
  ['listGlobalAiModels', 'GET', '/v1/ai_models'],
  ['listProjects', 'GET', '/v1/workspaces/{id}/projects'],
  ['createProject', 'POST', '/v1/workspaces/{id}/projects'],
  ['getProject', 'GET', '/v1/workspaces/{id}/projects/{project_id}'],
  ['updateProject', 'PATCH', '/v1/workspaces/{id}/projects/{project_id}'],
  ['deleteProject', 'DELETE', '/v1/workspaces/{id}/projects/{project_id}'],
  ['publishProject', 'POST', '/v1/workspaces/{id}/projects/{project_id}/publish'],
  ['listAiModels', 'GET', '/v1/workspaces/{id}/projects/{project_id}/ai_models'],
  ['deleteAiModels', 'DELETE', '/v1/workspaces/{id}/projects/{project_id}/ai_models'],
  ['listBenchmarks', 'GET', '/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks'],
  ['deleteBenchmarks', 'DELETE', '/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks'],
  ['updateBenchmark', 'PUT', '/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks/{benchmark_id}'],
  ['updateCompetitors', 'PUT', '/v1/workspaces/{id}/projects/{project_id}/ci/competitors'],
  ['createAioModel', 'POST', '/v2/workspaces/{id}/projects/{project_id}/ai_models'],
  ['createBenchmarks', 'POST', '/v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks'],
  ['listBrandUrls', 'GET', '/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls'],
  ['createBrandUrls', 'POST', '/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls'],
  ['deleteBrandUrls', 'DELETE', '/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls'],
  ['getProjectInitStatus', 'GET', '/v2/workspaces/{id}/projects/{project_id}/aio/init_status'],
  ['createPrompts', 'POST', '/v2/workspaces/{id}/projects/{project_id}/aio/prompts'],
  ['deletePromptsByIds', 'DELETE', '/v2/workspaces/{id}/projects/{project_id}/aio/prompts'],
  ['listPromptsByTagIds', 'POST', '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags'],
  ['updatePromptTags', 'PUT', '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tags'],
  ['renamePrompt', 'POST', '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}/rename'],
  ['listProjectTags', 'GET', '/v2/workspaces/{id}/projects/{project_id}/aio/tags'],
  ['createProjectTags', 'POST', '/v2/workspaces/{id}/projects/{project_id}/aio/tags'],
  ['updateProjectTag', 'PATCH', '/v2/workspaces/{id}/projects/{project_id}/aio/tags/{tag_id}'],
];

describe('createSerenityProjectEngineTransport', () => {
  it('exposes exactly the 28 declared facade methods, all functions', () => {
    const transport = make(sandbox.stub().resolves(json({})));
    const names = Object.keys(transport);
    expect(names).to.have.length(28);
    expect(names.sort()).to.deep.equal(OPERATIONS.map(([n]) => n).sort());
    names.forEach((n) => expect(transport[n]).to.be.a('function'));
  });

  describe('routes each method to the right HTTP method + path', () => {
    OPERATIONS.forEach(([facade, httpMethod, template]) => {
      it(`${facade} → ${httpMethod} ${template}`, async () => {
        const fetch = sandbox.stub().resolves(json({ ok: true }));
        const transport = make(fetch);

        const init = { params: { path: pathParamsFor(template) } };
        const result = await transport[facade](init);

        expect(fetch.callCount).to.equal(1);
        const request = fetch.firstCall.args[0];
        expect(request.method).to.equal(httpMethod);
        expect(new URL(request.url).pathname).to.equal(`${PREFIX}${resolve(template)}`);
        // A 2xx JSON body is unwrapped and returned as-is.
        expect(result).to.deep.equal({ ok: true });
      });
    });
  });

  describe('unwrap error seam', () => {
    it('(a) ok + JSON data → returns the parsed body', async () => {
      const transport = make(sandbox.stub().resolves(json({ hello: 'world' })));
      expect(await transport.listLanguages()).to.deep.equal({ hello: 'world' });
    });

    it('(b) ok + empty body (204) → returns null', async () => {
      const transport = make(sandbox.stub().resolves(new Response(null, { status: 204 })));
      expect(await transport.listLanguages()).to.equal(null);
    });

    it('(c) non-2xx with a JSON error body → throws with the status message', async () => {
      const transport = make(sandbox.stub().resolves(json({ message: 'nope' }, 404)));
      let thrown;
      try {
        await transport.listLanguages();
      } catch (e) {
        thrown = e;
      }
      expect(thrown).to.be.an('error');
      expect(thrown.constructor).to.equal(Error); // a plain Error for this ticket
      expect(thrown.message).to.match(/^Project Engine GET failed: 404$/);
    });

    it('(d) non-2xx (5xx) with a JSON error body → throws with the status message', async () => {
      // openapi-fetch ALWAYS routes a non-ok body into `error`, never `data` — so the
      // `error ?? data` expression's `data` fallback operand is only reachable when `error`
      // is nullish, which is the empty-body non-ok path exercised by case (f) below (there
      // `data` is undefined too). This case pins the sibling 5xx path: a parseable error body.
      const transport = make(sandbox.stub().resolves(json({ detail: 'boom' }, 500)));
      let thrown;
      try {
        await transport.listLanguages();
      } catch (e) {
        thrown = e;
      }
      expect(thrown).to.be.an('error');
      expect(thrown.message).to.contain('failed: 500');
    });

    it('(e) non-2xx with an empty-string body → normalized to null (no throw-shape change)', async () => {
      // Must stub (not a real Response) to reach the `error === ''` → null branch: a real
      // `new Response('', …)` makes openapi-fetch skip the empty body and leave `error`
      // undefined — that is case (f), not this one. Forcing a present, empty *text* body is
      // the only way to make openapi-fetch surface `error = ''`.
      const fetch = sandbox.stub().resolves({
        ok: false,
        status: 400,
        headers: new Headers(),
        clone() { return this; },
        text: async () => '',
      });
      const transport = make(fetch);
      let thrown;
      try {
        await transport.listLanguages();
      } catch (e) {
        thrown = e;
      }
      expect(thrown).to.be.an('error');
      expect(thrown.message).to.contain('failed: 400');
    });

    it('(f) non-2xx with neither data nor error → null body', async () => {
      // A real non-ok Response with an explicit `content-length: 0`: openapi-fetch skips
      // parsing (rather than reading '' from the empty body), leaving `error = undefined` — so
      // unwrap's `error ?? data ?? null` falls through the nullish path to null.
      const fetch = sandbox.stub().resolves(
        new Response(null, { status: 503, headers: { 'content-length': '0' } }),
      );
      const transport = make(fetch);
      let thrown;
      try {
        await transport.listLanguages();
      } catch (e) {
        thrown = e;
      }
      expect(thrown).to.be.an('error');
      expect(thrown.message).to.contain('failed: 503');
    });

    it('(g) a rejected fetch (network error) propagates out through unwrap', async () => {
      const boom = new Error('network down');
      const transport = make(sandbox.stub().rejects(boom));
      let thrown;
      try {
        await transport.listLanguages();
      } catch (e) {
        thrown = e;
      }
      expect(thrown).to.equal(boom);
    });
  });
});
