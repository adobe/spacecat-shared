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

import CloudFrontClient from '../src/index.js';

const REGION = 'us-east-1';

describe('CloudFrontClient', () => {
  describe('createFrom', () => {
    it('creates a client from context.env', () => {
      const log = { info() {} };
      const client = CloudFrontClient.createFrom({ env: { AWS_REGION: REGION }, log });
      expect(client).to.be.instanceOf(CloudFrontClient);
      expect(client.region).to.equal(REGION);
      expect(client.log).to.equal(log);
    });

    it('defaults to console when no log is provided', () => {
      const client = CloudFrontClient.createFrom({ env: { AWS_REGION: REGION } });
      expect(client.log).to.equal(console);
    });
  });

  describe('constructor', () => {
    it('throws when region is missing', () => {
      expect(() => new CloudFrontClient({}, { info() {} }))
        .to.throw('CloudFrontClient requires region');
    });

    it('stores the region and log', () => {
      const log = { info() {} };
      const client = new CloudFrontClient({ region: REGION }, log);
      expect(client.region).to.equal(REGION);
      expect(client.log).to.equal(log);
    });

    it('defaults to console when no log is provided', () => {
      const client = new CloudFrontClient({ region: REGION });
      expect(client.log).to.equal(console);
    });
  });
});
