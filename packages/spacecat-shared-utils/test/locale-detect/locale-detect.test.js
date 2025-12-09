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

import { expect } from 'chai';
import nock from 'nock';

import { detectLocale } from '../../src/locale-detect/locale-detect.js';

describe('Locale Detection', () => {
  const baseUrl = 'https://www.example.com';

  describe('detectLocale', () => {
    afterEach(() => {
      nock.cleanAll();
    });

    it('throws an error if no baseUrl is provided', async () => {
      await expect(detectLocale({})).to.be.rejectedWith('Invalid baseUrl');
    });

    it('throws an error if the baseUrl is invalid', async () => {
      await expect(detectLocale({ baseUrl: 'invalid-url' })).to.be.rejectedWith('Invalid baseUrl');
    });

    it('fetches HTML and headers if not provided', async () => {
      const scope = nock(baseUrl)
        .get('/')
        .reply(200, '<html><head><title>Test Page</title></head></html>', {
          'content-language': 'en-US',
        });

      await detectLocale({ baseUrl, indicatorFuncs: [] });

      expect(scope.isDone()).to.be.true;
    });

    it('fetches headers if HTML is provided', async () => {
      const scope = nock(baseUrl)
        .head('/')
        .reply(200, {
          'content-language': 'en-US',
        });

      await detectLocale({ baseUrl, indicatorFuncs: [], html: '<html><head><title>Test Page</title></head></html>' });

      expect(scope.isDone()).to.be.true;
    });

    it('returns a default locale if no indicator results are available', async () => {
      nock(baseUrl)
        .head('/')
        .reply(200, '', { 'content-type': 'text/html' });

      const result = await detectLocale({
        baseUrl,
        indicatorFuncs: [],
        html: '<html><head><title>Test Page</title></head></html>',
        headers: {},
      });
      expect(result).to.deep.equal({ language: 'en', region: 'US' });
    });

    it('summarizes indicator results with mixed indicators', async () => {
      nock(baseUrl)
        .head('/')
        .reply(200, '', { 'content-type': 'text/html' });

      const indicator = () => ([
        { language: 'de' },
        { region: 'CH' },
      ]);
      const result = await detectLocale({
        baseUrl,
        indicatorFuncs: [indicator],
        html: '<html><head><title>Test Page</title></head></html>',
        headers: {},
      });
      expect(result).to.deep.equal({ language: 'de', region: 'CH' });
    });

    it('summarizes indicator results by majority', async () => {
      nock(baseUrl)
        .head('/')
        .reply(200, '', { 'content-type': 'text/html' });

      const indicator = () => ([
        { language: 'de', region: 'DE' },
        { region: 'CH' },
        { language: 'de', region: 'CH' },
      ]);
      const result = await detectLocale({
        baseUrl,
        indicatorFuncs: [indicator],
        html: '<html><head><title>Test Page</title></head></html>',
        headers: {},
      });
      expect(result).to.deep.equal({ language: 'de', region: 'CH' });
    });
  });
});
