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

import { expect } from 'chai';
import oauthNonceSchema from '../../../../src/models/oauth-nonce/oauth-nonce.schema.js';

describe('OAuthNonce Schema', () => {
  let attributes;

  before(() => {
    attributes = oauthNonceSchema.getAttributes();
  });

  describe('nonce attribute', () => {
    it('exists', () => {
      expect(attributes.nonce).to.exist;
    });

    it('is required', () => {
      expect(attributes.nonce.required).to.be.true;
    });

    it('is readOnly', () => {
      expect(attributes.nonce.readOnly).to.be.true;
    });

    it('is of type string', () => {
      expect(attributes.nonce.type).to.equal('string');
    });
  });

  describe('expiresAt attribute', () => {
    it('exists', () => {
      expect(attributes.expiresAt).to.exist;
    });

    it('is required', () => {
      expect(attributes.expiresAt.required).to.be.true;
    });

    it('is of type string', () => {
      expect(attributes.expiresAt.type).to.equal('string');
    });

    it('validates ISO date strings', () => {
      expect(attributes.expiresAt.validate('2025-01-01T00:00:00.000Z')).to.be.true;
    });

    it('rejects non-ISO strings', () => {
      expect(attributes.expiresAt.validate('not-a-date')).to.be.false;
    });
  });
});
