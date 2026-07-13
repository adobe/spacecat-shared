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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

import Ticket from '../../../../src/models/ticket/ticket.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('TicketCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    ticketId: 'aaaaaaaa-0000-4000-b000-000000000001',
    organizationId: 'bbbbbbbb-0000-4000-b000-000000000001',
    taskManagementConnectionId: 'cccccccc-0000-4000-b000-000000000001',
    opportunityId: 'dddddddd-0000-4000-b000-000000000001',
    externalTicketId: '10001',
    ticketKey: 'ASO-1',
    ticketUrl: 'https://acme.atlassian.net/browse/ASO-1',
    ticketProvider: 'jira_cloud',
    createdBy: 'test-user',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Ticket, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the TicketCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('auto-generated index methods', () => {
    it('exposes allByOrganizationId', () => {
      expect(instance.allByOrganizationId).to.be.a('function');
    });

    it('exposes allByTaskManagementConnectionId', () => {
      expect(instance.allByTaskManagementConnectionId).to.be.a('function');
    });

    it('exposes allByOpportunityId', () => {
      expect(instance.allByOpportunityId).to.be.a('function');
    });

    it('exposes findByOpportunityId', () => {
      expect(instance.findByOpportunityId).to.be.a('function');
    });

    it('rejects allByOrganizationId when organizationId is missing', async () => {
      await expect(instance.allByOrganizationId('')).to.be.rejectedWith('organizationId is required');
    });

    it('rejects allByOpportunityId when opportunityId is missing', async () => {
      await expect(instance.allByOpportunityId('')).to.be.rejectedWith('opportunityId is required');
    });
  });
});
