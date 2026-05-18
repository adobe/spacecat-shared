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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import Organization from '../../../../src/models/organization/organization.model.js';
import organizationFixtures from '../../../fixtures/organizations.fixture.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleOrganization = organizationFixtures[0];

describe('OrganizationModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleOrganization;

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(Organization, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the Organization instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('organizationId', () => {
    it('gets organizationId', () => {
      expect(instance.getId()).to.equal('4854e75e-894b-4a74-92bf-d674abad1423');
    });
  });

  describe('config', () => {
    it('gets config', () => {
      const config = instance.getConfig();
      delete config.imports;
      expect(config).to.deep.equal(sampleOrganization.config);
    });
  });

  describe('name', () => {
    it('gets name', () => {
      expect(instance.getName()).to.equal('0-1234Name');
    });

    it('sets name', () => {
      instance.setName('Some Name');
      expect(instance.record.name).to.equal('Some Name');
    });
  });

  describe('imsOrgId', () => {
    it('gets imsOrgId', () => {
      expect(instance.getImsOrgId()).to.equal('1234567890ABCDEF12345678@AdobeOrg');
    });

    it('sets imsOrgId', () => {
      instance.setImsOrgId('newImsOrgId');
      expect(instance.getImsOrgId()).to.equal('newImsOrgId');
    });
  });

  describe('semrushWorkspaceId', () => {
    it('gets semrushWorkspaceId', () => {
      expect(instance.getSemrushWorkspaceId()).to.equal('ws_fixture_001');
    });

    it('sets semrushWorkspaceId', () => {
      instance.setSemrushWorkspaceId('ws_new_value');
      expect(instance.getSemrushWorkspaceId()).to.equal('ws_new_value');
    });

    it('returns undefined when semrushWorkspaceId is absent on the record', () => {
      const recordWithoutSemrush = { ...sampleOrganization };
      delete recordWithoutSemrush.semrushWorkspaceId;
      const { model: instanceWithout } = createElectroMocks(Organization, recordWithoutSemrush);
      expect(instanceWithout.getSemrushWorkspaceId()).to.equal(undefined);
    });
  });

  describe('fulfillableItems', () => {
    it('gets fulfillableItems', () => {
      expect(instance.getFulfillableItems()).to.deep.equal(undefined);
    });

    it('sets fulfillableItems', () => {
      instance.setFulfillableItems(['item3', 'item4']);
      expect(instance.getFulfillableItems()).to.deep.equal(['item3', 'item4']);
    });
  });

  describe('llmBackend', () => {
    it('defaults to azure', () => {
      expect(instance.getLlmBackend()).to.equal('azure');
    });

    it('sets llmBackend to bedrock', () => {
      instance.setLlmBackend('bedrock');
      expect(instance.getLlmBackend()).to.equal('bedrock');
    });

    it('sets llmBackend back to azure', () => {
      instance.setLlmBackend('bedrock');
      instance.setLlmBackend('azure');
      expect(instance.getLlmBackend()).to.equal('azure');
    });
  });

  describe('LLM_BACKENDS constants', () => {
    it('defines LLM_BACKEND_AZURE', () => {
      expect(Organization.LLM_BACKEND_AZURE).to.equal('azure');
    });

    it('defines LLM_BACKEND_BEDROCK', () => {
      expect(Organization.LLM_BACKEND_BEDROCK).to.equal('bedrock');
    });

    it('defines LLM_BACKENDS list', () => {
      expect(Organization.LLM_BACKENDS).to.deep.equal(['azure', 'bedrock']);
    });
  });
});
