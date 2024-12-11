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

import Experiment from '../../../../../src/v2/models/experiment/experiment.model.js';
import ExperimentSchema from '../../../../../src/v2/models/experiment/experiment.schema.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const { attributes } = new Entity(ExperimentSchema).model.schema;

describe('Experiment', () => {
  let experimentInstance;
  let mockElectroService;
  let mockModelFactory;
  let mockRecord;
  let mockLogger;

  beforeEach(() => {
    mockElectroService = {
      entities: {
        experiment: {
          model: {
            name: 'experiment',
            schema: { attributes },
            original: {
              references: {},
            },
            indexes: {
              primary: {
                pk: {
                  field: 'pk',
                  composite: ['experimentId'],
                },
              },
            },
          },
          patch: stub().returns({
            set: stub(),
          }),
        },
      },
    };

    mockModelFactory = {
      getCollection: stub(),
    };

    mockLogger = {
      error: spy(),
    };

    mockRecord = {
      experimentId: 'e12345',
      siteId: 'site67890',
      conversionEventName: 'someConversionEventName',
      conversionEventValue: '100',
      endDate: '2024-01-01T00:00:00.000Z',
      expId: 'someExpId',
      name: 'someName',
      startDate: '2024-01-01T00:00:00.000Z',
      status: 'ACTIVE',
      type: 'someType',
      url: 'someUrl',
      updatedBy: 'someUpdatedBy',
      variants: [{ someVariant: 'someVariant' }],
    };

    experimentInstance = new Experiment(
      mockElectroService,
      mockModelFactory,
      mockRecord,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the Experiment instance correctly', () => {
      expect(experimentInstance).to.be.an('object');
      expect(experimentInstance.record).to.deep.equal(mockRecord);
    });
  });

  describe('experimentId', () => {
    it('gets experimentId', () => {
      expect(experimentInstance.getId()).to.equal('e12345');
    });
  });

  describe('siteId', () => {
    it('gets siteId', () => {
      expect(experimentInstance.getSiteId()).to.equal('site67890');
    });

    it('sets siteId', () => {
      experimentInstance.setSiteId('newSiteId');
      expect(experimentInstance.getSiteId()).to.equal('newSiteId');
    });
  });

  describe('conversionEventName', () => {
    it('gets conversionEventName', () => {
      expect(experimentInstance.getConversionEventName()).to.equal('someConversionEventName');
    });

    it('sets conversionEventName', () => {
      experimentInstance.setConversionEventName('newConversionEventName');
      expect(experimentInstance.getConversionEventName()).to.equal('newConversionEventName');
    });
  });

  describe('conversionEventValue', () => {
    it('gets conversionEventValue', () => {
      expect(experimentInstance.getConversionEventValue()).to.equal('100');
    });

    it('sets conversionEventValue', () => {
      experimentInstance.setConversionEventValue('200');
      expect(experimentInstance.getConversionEventValue()).to.equal('200');
    });
  });

  describe('endDate', () => {
    it('gets endDate', () => {
      expect(experimentInstance.getEndDate()).to.equal('2024-01-01T00:00:00.000Z');
    });

    it('sets endDate', () => {
      const newEndDate = '2024-01-02T00:00:00.000Z';
      experimentInstance.setEndDate(newEndDate);
      expect(experimentInstance.getEndDate()).to.equal(newEndDate);
    });
  });

  describe('expId', () => {
    it('gets expId', () => {
      expect(experimentInstance.getExpId()).to.equal('someExpId');
    });

    it('sets expId', () => {
      experimentInstance.setExpId('newExpId');
      expect(experimentInstance.getExpId()).to.equal('newExpId');
    });
  });

  describe('name', () => {
    it('gets name', () => {
      expect(experimentInstance.getName()).to.equal('someName');
    });

    it('sets name', () => {
      experimentInstance.setName('newName');
      expect(experimentInstance.getName()).to.equal('newName');
    });
  });

  describe('startDate', () => {
    it('gets startDate', () => {
      expect(experimentInstance.getStartDate()).to.equal('2024-01-01T00:00:00.000Z');
    });

    it('sets startDate', () => {
      const newStartDate = '2024-01-02T00:00:00.000Z';
      experimentInstance.setStartDate(newStartDate);
      expect(experimentInstance.getStartDate()).to.equal(newStartDate);
    });
  });

  describe('status', () => {
    it('gets status', () => {
      expect(experimentInstance.getStatus()).to.equal('ACTIVE');
    });

    it('sets status', () => {
      experimentInstance.setStatus('INACTIVE');
      expect(experimentInstance.getStatus()).to.equal('INACTIVE');
    });
  });

  describe('type', () => {
    it('gets type', () => {
      expect(experimentInstance.getType()).to.equal('someType');
    });

    it('sets type', () => {
      experimentInstance.setType('newType');
      expect(experimentInstance.getType()).to.equal('newType');
    });
  });

  describe('url', () => {
    it('gets url', () => {
      expect(experimentInstance.getUrl()).to.equal('someUrl');
    });

    it('sets url', () => {
      experimentInstance.setUrl('newUrl');
      expect(experimentInstance.getUrl()).to.equal('newUrl');
    });
  });

  describe('updatedBy', () => {
    it('gets updatedBy', () => {
      expect(experimentInstance.getUpdatedBy()).to.equal('someUpdatedBy');
    });

    it('sets updatedBy', () => {
      experimentInstance.setUpdatedBy('newUpdatedBy');
      expect(experimentInstance.getUpdatedBy()).to.equal('newUpdatedBy');
    });
  });

  describe('variants', () => {
    it('gets variants', () => {
      expect(experimentInstance.getVariants()).to.deep.equal([{ someVariant: 'someVariant' }]);
    });

    it('sets variants', () => {
      experimentInstance.setVariants([{ newVariant: 'newVariant' }]);
      expect(experimentInstance.getVariants()).to.deep.equal([{ newVariant: 'newVariant' }]);
    });
  });
});
