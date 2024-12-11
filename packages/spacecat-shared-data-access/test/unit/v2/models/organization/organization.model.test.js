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

import Organization from '../../../../../src/v2/models/organization/organization.model.js';
import OrganizationSchema from '../../../../../src/v2/models/organization/organization.schema.js';
import organizationFixtures from '../../../../fixtures/organizations.fixture.js';
import { Config } from '../../../../../src/models/site/config.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const { attributes } = new Entity(OrganizationSchema).model.schema;
const sampleOrganization = organizationFixtures[0];

describe('Organization', () => {
  let organizationInstance;
  let mockElectroService;
  let mockModelFactory;
  let mockRecord;
  let mockLogger;

  beforeEach(() => {
    mockElectroService = {
      entities: {
        organization: {
          model: {
            name: 'organization',
            schema: { attributes },
            original: {
              references: {},
            },
            indexes: {
              primary: {
                pk: {
                  field: 'pk',
                  composite: ['organizationId'],
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

    mockRecord = sampleOrganization;

    organizationInstance = new Organization(
      mockElectroService,
      mockModelFactory,
      mockRecord,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the Organization instance correctly', () => {
      expect(organizationInstance).to.be.an('object');
      expect(organizationInstance.record).to.deep.equal(mockRecord);
    });
  });

  describe('organizationId', () => {
    it('gets organizationId', () => {
      expect(organizationInstance.getId()).to.equal('4854e75e-894b-4a74-92bf-d674abad1423');
    });
  });

  describe('config', () => {
    it('gets config', () => {
      const config = Config.toDynamoItem(organizationInstance.getConfig());
      delete config.imports;
      expect(config).to.deep.equal(sampleOrganization.config);
    });
  });

  describe('name', () => {
    it('gets name', () => {
      expect(organizationInstance.getName()).to.equal('0-1234Name');
    });

    it('sets name', () => {
      organizationInstance.setName('Some Name');
      expect(organizationInstance.record.name).to.equal('Some Name');
    });
  });

  describe('imsOrgId', () => {
    it('gets imsOrgId', () => {
      expect(organizationInstance.getImsOrgId()).to.equal('0-1234@AdobeOrg');
    });

    it('sets imsOrgId', () => {
      organizationInstance.setImsOrgId('newImsOrgId');
      expect(organizationInstance.getImsOrgId()).to.equal('newImsOrgId');
    });
  });

  describe('fulfillableItems', () => {
    it('gets fulfillableItems', () => {
      expect(organizationInstance.getFulfillableItems()).to.deep.equal(undefined);
    });

    it('sets fulfillableItems', () => {
      organizationInstance.setFulfillableItems(['item3', 'item4']);
      expect(organizationInstance.getFulfillableItems()).to.deep.equal(['item3', 'item4']);
    });
  });
});
