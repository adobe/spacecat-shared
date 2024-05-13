/*
 * Copyright 2023 Adobe. All rights reserved.
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

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import {
  create404URL, createRUMURL, createExperimentationURL, createConversionURL,
} from '../src/index.js';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('create urls tests', () => {
  afterEach('clean each', () => {
    nock.cleanAll();
  });

  it('returns the URL to call the get404Sources', () => {
    expect(create404URL({ url: 'http://spacecar.com' }))
      .to.eql('https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=7&offset=0&limit=101&url=http%3A%2F%2Fspacecar.com');
  });

  it('returns the URL to call the getRUMDashboard', () => {
    expect(createRUMURL({ url: 'http://spacecar.com' }))
      .to.eql('https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-dashboard?interval=7&offset=0&limit=101&url=http%3A%2F%2Fspacecar.com');
  });

  it('returns the URL to get the Experimentation data', () => {
    expect(createExperimentationURL({ url: 'http://spacecat.com' }))
      .to.eql('https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-experiments?interval=7&offset=0&limit=101&url=http%3A%2F%2Fspacecat.com');
  });

  it('returns the URL to get the Conversion data', () => {
    expect(createConversionURL({ url: 'http://spacecat.com' }))
      .to.eql('https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-sources?interval=7&offset=0&limit=101&checkpoint=convert&aggregate=false&url=http%3A%2F%2Fspacecat.com');
  });
});
