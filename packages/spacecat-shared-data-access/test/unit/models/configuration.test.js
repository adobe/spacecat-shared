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

/* eslint-env mocha */
import { expect } from 'chai';
import { createConfiguration } from '../../../src/models/configuration.js';
import { sleep } from '../util.js';

const validData = {
  id: 'jobs',
  configMap: {
    daily: [
      { group: 'audits', type: 'lhs-mobile' },
      { group: 'audits', type: '404' },
      { group: 'imports', type: 'rum-ingest' },
    ],
    weekly: [
      { group: 'reports', type: '404-external-digest' },
      { group: 'audits', type: 'apex' },
    ],
  },
};

describe('Configuration Model Tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if id is empty', () => {
      expect(() => createConfiguration({ ...validData, id: '' })).to.throw('Configuration ID must be provided');
    });
    it('throws an error if configMap is empty', () => {
      expect(() => createConfiguration({ ...validData, configMap: '' })).to.throw('Configuration Map must be provided');
    });

    it('creates a configuration', () => {
      const configuration = createConfiguration({ ...validData });
      expect(configuration).to.be.an('object');
      expect(configuration.getId()).to.equal(validData.id);
      expect(configuration.getConfigMap()).to.deep.equal(validData.configMap);
    });
  });

  describe('Configuration Object Functionality', () => {
    let configuration;

    beforeEach(() => {
      configuration = createConfiguration(validData);
    });

    it('updates configMap correctly', () => {
      const configMap = { ...validData, configMap: { weekly: validData.configMap.weekly.push({ group: 'audits', type: 'organicKeywords' }) } };
      configuration.updateConfigMap(configMap);
      expect(configuration.getConfigMap()).to.deep.equal(configMap);
    });

    it('throws an error when updating with an empty configMap', () => {
      expect(() => configuration.updateConfigMap('')).to.throw('Configuration Map must be an object');
    });

    it('updates updatedAt when config is updated', async () => {
      const initialUpdatedAt = configuration.getUpdatedAt();

      await sleep(20);

      configuration.updateConfigMap({});

      expect(configuration.getUpdatedAt()).to.not.equal(initialUpdatedAt);
    });
  });
});
