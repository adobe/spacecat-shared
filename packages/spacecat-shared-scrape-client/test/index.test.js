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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import ScrapeClient from '../src/index.js';

use(chaiAsPromised);

describe('ScrapeClient unit tests', () => {
  let client;

  const config = {};
  const context = {
    env: {},
    log: console,
  };

  beforeEach(() => {
    client = new ScrapeClient(config);
  });

  afterEach(() => {
  });

  describe('constructor', () => {
    it('creates an instance of ScrapeClient', () => {
      expect(client).to.be.instanceOf(ScrapeClient);
    });
  });

  describe('createFrom', () => {
    it('creates an instance from context', () => {
      const scrapeClient = ScrapeClient.createFrom(context);
      expect(scrapeClient).to.be.instanceOf(ScrapeClient);
    });
  });
});
