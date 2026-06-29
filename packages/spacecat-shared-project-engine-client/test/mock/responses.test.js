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

import { expect } from 'chai';
import { emptyAck } from '../../mock/responses.js';

describe('mock responses', () => {
  describe('emptyAck', () => {
    it('returns the raw empty-202 ack with an explicit content type (the negotiation bypass)', () => {
      expect(emptyAck()).to.deep.equal({
        status: 202,
        body: '',
        contentType: 'application/json',
      });
    });

    it('carries the content type — the field that makes Counterfact skip negotiation', () => {
      // The bug this guards against: without `contentType`, an empty-body 2xx is negotiated and
      // 406s under `Accept: application/json`. Its presence (any value) is what triggers the
      // raw-return bypass; assert it is set so a regression that drops it is caught.
      expect(emptyAck()).to.have.property('contentType', 'application/json');
    });

    it('acks with the given 2xx status (and still bypasses negotiation)', () => {
      // The non-default arg exercises the other branch of the `status = 202` default, so the
      // no-arg test above plus this one cover both; an empty body + contentType stay invariant.
      expect(emptyAck(200)).to.deep.equal({ status: 200, body: '', contentType: 'application/json' });
    });
  });
});
