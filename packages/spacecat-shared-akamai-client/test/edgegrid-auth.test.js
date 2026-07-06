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

import { edgeGridTimestamp, signRequest } from '../src/edgegrid-auth.js';

const FIXED_TS = '20260702T12:00:00+0000';
const FIXED_NONCE = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const CREDS = {
  clientToken: 'test-client-token',
  clientSecret: 'test-client-secret',
  accessToken: 'test-access-token',
};

describe('edgegrid-auth', () => {
  describe('edgeGridTimestamp', () => {
    it('formats a given date as yyyyMMddTHH:mm:ss+0000 (UTC)', () => {
      const date = new Date(Date.UTC(2026, 6, 2, 9, 5, 3));
      expect(edgeGridTimestamp(date)).to.equal('20260702T09:05:03+0000');
    });

    it('defaults to the current time when no date is given', () => {
      const before = Date.now();
      const ts = edgeGridTimestamp();
      const after = Date.now();
      expect(ts).to.match(/^\d{8}T\d{2}:\d{2}:\d{2}\+0000$/);
      const parsedYear = Number(ts.slice(0, 4));
      expect(parsedYear).to.equal(new Date(before).getUTCFullYear());
      expect(after - before).to.be.lessThan(5000);
    });
  });

  describe('signRequest', () => {
    // Cross-validated byte-for-byte against Python's official edgegrid-python
    // EdgeGridAuth for the same fixed timestamp/nonce/credentials/URL/body.
    it('matches the reference EdgeGrid signature for a GET request (no body)', () => {
      const header = signRequest({
        method: 'GET',
        url: 'https://akab-xxxxx.luna.akamaiapis.net/papi/v1/properties/prp_123/versions/latest?contractId=ctr_1&groupId=grp_1',
        timestamp: FIXED_TS,
        nonce: FIXED_NONCE,
        ...CREDS,
      });
      expect(header).to.equal(
        'EG1-HMAC-SHA256 client_token=test-client-token;access_token=test-access-token;'
        + 'timestamp=20260702T12:00:00+0000;nonce=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee;'
        + 'signature=kvFG+F7VJ8crdI/AD1vsECVGekF+w/Mrh13y8cGkYUY=',
      );
    });

    it('matches the reference EdgeGrid signature for a PUT request with a JSON body', () => {
      const header = signRequest({
        method: 'PUT',
        url: 'https://akab-xxxxx.luna.akamaiapis.net/papi/v1/properties/prp_123/versions/5/rules?contractId=ctr_1&groupId=grp_1&validateRules=true',
        body: '{"rules":{"name":"default"}}',
        timestamp: FIXED_TS,
        nonce: FIXED_NONCE,
        ...CREDS,
      });
      expect(header).to.equal(
        'EG1-HMAC-SHA256 client_token=test-client-token;access_token=test-access-token;'
        + 'timestamp=20260702T12:00:00+0000;nonce=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee;'
        + 'signature=CaDSAfv27qDVchPAgEg+KxJgOaqPPdiJmkb1JCDsVE8=',
      );
    });

    it('produces a different signature for a POST body than for the same body on PUT', () => {
      const base = {
        url: 'https://akab-xxxxx.luna.akamaiapis.net/papi/v1/some/path',
        body: '{"a":1}',
        timestamp: FIXED_TS,
        nonce: FIXED_NONCE,
        ...CREDS,
      };
      const post = signRequest({ ...base, method: 'POST' });
      const put = signRequest({ ...base, method: 'PUT' });
      expect(post).to.not.equal(put);
    });

    it('ignores an empty POST body the same as no body at all', () => {
      const base = {
        url: 'https://akab-xxxxx.luna.akamaiapis.net/papi/v1/some/path',
        method: 'POST',
        timestamp: FIXED_TS,
        nonce: FIXED_NONCE,
        ...CREDS,
      };
      expect(signRequest({ ...base, body: '' })).to.equal(signRequest(base));
    });

    it('includes canonicalized headersToSign in the signature when provided', () => {
      const base = {
        url: 'https://akab-xxxxx.luna.akamaiapis.net/papi/v1/some/path',
        method: 'GET',
        timestamp: FIXED_TS,
        nonce: FIXED_NONCE,
        ...CREDS,
      };
      const withHeaders = signRequest({
        ...base,
        headersToSign: { 'X-Custom': '  multiple   spaces  ' },
      });
      const withoutHeaders = signRequest(base);
      expect(withHeaders).to.not.equal(withoutHeaders);
    });

    it('truncates the POST body at MAX_BODY_BYTES so trailing bytes do not affect the signature', () => {
      // MAX_BODY_BYTES is 131072; a body at exactly the limit and the same body
      // with extra bytes appended must sign identically. Guards against the
      // subarray(0, MAX_BODY_BYTES) truncation being removed or the constant
      // changed — the reference-vector tests use small bodies and wouldn't catch it.
      const base = {
        method: 'POST',
        url: 'https://akab-xxxxx.luna.akamaiapis.net/papi/v1/some/path',
        timestamp: FIXED_TS,
        nonce: FIXED_NONCE,
        ...CREDS,
      };
      const exactBody = 'x'.repeat(131072);
      const overBody = `${exactBody}EXTRA_BYTES_BEYOND_LIMIT`;
      expect(signRequest({ ...base, body: exactBody }))
        .to.equal(signRequest({ ...base, body: overBody }));
    });

    it('generates a timestamp and nonce when not provided', () => {
      const header = signRequest({
        method: 'GET',
        url: 'https://akab-xxxxx.luna.akamaiapis.net/papi/v1/some/path',
        ...CREDS,
      });
      expect(header).to.match(
        /^EG1-HMAC-SHA256 client_token=test-client-token;access_token=test-access-token;timestamp=\d{8}T\d{2}:\d{2}:\d{2}\+0000;nonce=[0-9a-f-]{36};signature=.+$/,
      );
    });
  });
});
