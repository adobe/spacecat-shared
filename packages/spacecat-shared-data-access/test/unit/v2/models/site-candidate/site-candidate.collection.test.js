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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Entity } from 'electrodb';
import { spy, stub } from 'sinon';
import sinonChai from 'sinon-chai';

import SiteCandidateCollection from '../../../../../src/v2/models/site-candidate/site-candidate.collection.js';
import SiteCandidate from '../../../../../src/v2/models/site-candidate/site-candidate.model.js';
import SiteCandidateSchema from '../../../../../src/v2/models/site-candidate/site-candidate.schema.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const { attributes } = new Entity(SiteCandidateSchema).model.schema;

let mockElectroService;

describe('SiteCandidateCollection', () => {
  let instance;
  let mockSiteCandidateModel;
  let mockLogger;
  let mockEntityRegistry;

  const mockRecord = {
    siteCandidateId: 's12345',
    siteId: 's67890',
  };

  beforeEach(() => {
    mockLogger = {
      error: spy(),
      warn: spy(),
    };

    mockEntityRegistry = {
      getCollection: stub(),
    };

    mockElectroService = {
      entities: {
        siteCandidate: {
          model: {
            name: 'siteCandidate',
            schema: { attributes },
            original: {
              references: {},
            },
            indexes: {
              primary: {
                pk: {
                  field: 'pk',
                  composite: ['siteCandidateId'],
                },
              },
            },
          },
          delete: stub().returns({
            go: stub().resolves({}),
          }),
        },
      },
    };

    mockSiteCandidateModel = new SiteCandidate(
      mockElectroService,
      mockEntityRegistry,
      mockRecord,
      mockLogger,
    );

    instance = new SiteCandidateCollection(
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the SiteCandidateCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.log).to.equal(mockLogger);

      expect(mockSiteCandidateModel).to.be.an('object');
    });
  });
});
