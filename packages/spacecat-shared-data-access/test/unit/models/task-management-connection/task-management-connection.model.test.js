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
import { stub } from 'sinon';

import TaskManagementConnection from '../../../../src/models/task-management-connection/task-management-connection.model.js';
import TaskManagementConnectionCollection from '../../../../src/models/task-management-connection/task-management-connection.collection.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const VALID_ORG_ID = '22222222-2222-2222-2222-222222222222';

describe('TaskManagementConnectionModel', () => {
  let instance;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      taskManagementConnectionId: '11111111-1111-1111-1111-111111111111',
      organizationId: '22222222-2222-2222-2222-222222222222',
      provider: TaskManagementConnection.PROVIDERS.JIRA_CLOUD,
      status: TaskManagementConnection.STATUSES.ACTIVE,
      externalInstanceId: '33333333-3333-3333-3333-333333333333',
      displayName: 'My Jira Site',
      instanceUrl: 'https://my-org.atlassian.net',
      connectedBy: 'ims-user-id-123',
      metadata: { cloudId: '33333333-3333-3333-3333-333333333333', scopes: ['read:jira-work', 'write:jira-work'] },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      updatedBy: 'system',
    };

    ({ model: instance } = createElectroMocks(TaskManagementConnection, mockRecord));
  });

  describe('ENTITY_NAME', () => {
    it('is TaskManagementConnection', () => {
      expect(TaskManagementConnection.ENTITY_NAME).to.equal('TaskManagementConnection');
    });
  });

  describe('PROVIDERS', () => {
    it('defines JIRA_CLOUD provider', () => {
      expect(TaskManagementConnection.PROVIDERS.JIRA_CLOUD).to.equal('jira_cloud');
    });
  });

  describe('STATUSES', () => {
    it('defines ACTIVE status', () => {
      expect(TaskManagementConnection.STATUSES.ACTIVE).to.equal('active');
    });

    it('defines DISABLED status', () => {
      expect(TaskManagementConnection.STATUSES.DISABLED).to.equal('disabled');
    });

    it('defines REQUIRES_REAUTH status', () => {
      expect(TaskManagementConnection.STATUSES.REQUIRES_REAUTH).to.equal('requires_reauth');
    });

    it('defines ERROR status', () => {
      expect(TaskManagementConnection.STATUSES.ERROR).to.equal('error');
    });

    it('defines DISCONNECTED status', () => {
      expect(TaskManagementConnection.STATUSES.DISCONNECTED).to.equal('disconnected');
    });
  });

  describe('isActive()', () => {
    it('returns true when status is active', () => {
      expect(instance.isActive()).to.be.true;
    });

    it('returns false when status is disabled', () => {
      instance.record.status = TaskManagementConnection.STATUSES.DISABLED;
      expect(instance.isActive()).to.be.false;
    });

    it('returns false when status is requires_reauth', () => {
      instance.record.status = TaskManagementConnection.STATUSES.REQUIRES_REAUTH;
      expect(instance.isActive()).to.be.false;
    });

    it('returns false when status is error', () => {
      instance.record.status = TaskManagementConnection.STATUSES.ERROR;
      expect(instance.isActive()).to.be.false;
    });

    it('returns false when status is disconnected', () => {
      instance.record.status = TaskManagementConnection.STATUSES.DISCONNECTED;
      expect(instance.isActive()).to.be.false;
    });
  });

  describe('markRequiresReauth()', () => {
    it('sets status to requires_reauth and saves', async () => {
      const saveStub = stub(instance.patcher, 'save').resolves();

      await expect(instance.markRequiresReauth()).to.be.fulfilled;

      expect(saveStub).to.have.been.calledOnce;
      expect(instance.record.status).to.equal(TaskManagementConnection.STATUSES.REQUIRES_REAUTH);
    });

    it('propagates save errors', async () => {
      stub(instance.patcher, 'save').rejects(new Error('DB error'));

      await expect(instance.markRequiresReauth()).to.be.rejected;
    });
  });

  describe('markDisabled()', () => {
    it('sets status to disabled and saves', async () => {
      const saveStub = stub(instance.patcher, 'save').resolves();

      await expect(instance.markDisabled()).to.be.fulfilled;

      expect(saveStub).to.have.been.calledOnce;
      expect(instance.record.status).to.equal(TaskManagementConnection.STATUSES.DISABLED);
    });
  });

  describe('markError()', () => {
    it('sets status to error and saves', async () => {
      const saveStub = stub(instance.patcher, 'save').resolves();

      await expect(instance.markError()).to.be.fulfilled;

      expect(saveStub).to.have.been.calledOnce;
      expect(instance.record.status).to.equal(TaskManagementConnection.STATUSES.ERROR);
    });
  });

  describe('markDisconnected()', () => {
    it('sets status to disconnected and saves', async () => {
      const saveStub = stub(instance.patcher, 'save').resolves();

      await expect(instance.markDisconnected()).to.be.fulfilled;

      expect(saveStub).to.have.been.calledOnce;
      expect(instance.record.status).to.equal(TaskManagementConnection.STATUSES.DISCONNECTED);
    });
  });

  describe('markActive()', () => {
    it('sets status to active and saves', async () => {
      instance.record.status = TaskManagementConnection.STATUSES.REQUIRES_REAUTH;
      const saveStub = stub(instance.patcher, 'save').resolves();

      await expect(instance.markActive()).to.be.fulfilled;

      expect(saveStub).to.have.been.calledOnce;
      expect(instance.record.status).to.equal(TaskManagementConnection.STATUSES.ACTIVE);
    });

    it('propagates save errors', async () => {
      stub(instance.patcher, 'save').rejects(new Error('DB error'));

      await expect(instance.markActive()).to.be.rejected;
    });
  });
});

describe('TaskManagementConnectionCollection', () => {
  let collection;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let schema;

  const mockRecord = {
    taskManagementConnectionId: '11111111-1111-1111-1111-111111111111',
    organizationId: VALID_ORG_ID,
    provider: TaskManagementConnection.PROVIDERS.JIRA_CLOUD,
    status: TaskManagementConnection.STATUSES.ACTIVE,
    metadata: {},
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    updatedBy: 'system',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      schema,
    } = createElectroMocks(TaskManagementConnection, mockRecord));
    mockElectroService.entities = {};
    collection = new TaskManagementConnectionCollection(
      mockElectroService,
      mockEntityRegistry,
      schema,
      mockLogger,
    );
  });

  describe('findActiveByOrganizationAndProvider()', () => {
    it('delegates to findByOrganizationIdAndProviderAndStatus with active status', async () => {
      collection.findByOrganizationIdAndProviderAndStatus = stub().resolves(mockRecord);

      const result = await collection.findActiveByOrganizationAndProvider(
        VALID_ORG_ID,
        TaskManagementConnection.PROVIDERS.JIRA_CLOUD,
      );

      expect(result).to.equal(mockRecord);
      expect(collection.findByOrganizationIdAndProviderAndStatus).to.have.been.calledOnceWith(
        VALID_ORG_ID,
        TaskManagementConnection.PROVIDERS.JIRA_CLOUD,
        TaskManagementConnection.STATUSES.ACTIVE,
      );
    });

    it('returns null when no active connection exists', async () => {
      collection.findByOrganizationIdAndProviderAndStatus = stub().resolves(null);

      const result = await collection.findActiveByOrganizationAndProvider(
        VALID_ORG_ID,
        TaskManagementConnection.PROVIDERS.JIRA_CLOUD,
      );

      expect(result).to.be.null;
    });

    it('throws ValidationError when organizationId is not a valid UUID', async () => {
      await expect(
        collection.findActiveByOrganizationAndProvider('not-a-uuid', 'jira_cloud'),
      ).to.be.rejectedWith('organizationId must be a valid UUID');
    });

    it('throws ValidationError when provider is missing', async () => {
      await expect(
        collection.findActiveByOrganizationAndProvider(VALID_ORG_ID, ''),
      ).to.be.rejectedWith('provider is required');
    });
  });
});
