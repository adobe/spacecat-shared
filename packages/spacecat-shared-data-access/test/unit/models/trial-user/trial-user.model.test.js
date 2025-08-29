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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import TrialUser from '../../../../src/models/trial-user/trial-user.model.js';
import trialUserFixtures from '../../../fixtures/trial-users.fixture.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleTrialUser = trialUserFixtures[0];

describe('TrialUserModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleTrialUser;

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(TrialUser, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the TrialUser instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('trialUserId', () => {
    it('gets trialUserId', () => {
      expect(instance.getId()).to.equal('9b4f4013-63eb-44f7-9a3a-726930b923b5');
    });
  });

  describe('organizationId', () => {
    it('gets organizationId', () => {
      expect(instance.getOrganizationId()).to.equal('4854e75e-894b-4a74-92bf-d674abad1423');
    });

    it('sets organizationId', () => {
      instance.setOrganizationId('4854e75e-894b-4a74-92bf-d674abad1424');
      expect(instance.getOrganizationId()).to.equal('4854e75e-894b-4a74-92bf-d674abad1424');
    });
  });

  describe('externalUserId', () => {
    it('gets externalUserId', () => {
      expect(instance.getExternalUserId()).to.equal('ext-user-123');
    });

    it('sets externalUserId', () => {
      instance.setExternalUserId('new-external-user-id');
      expect(instance.getExternalUserId()).to.equal('new-external-user-id');
    });
  });

  describe('status', () => {
    it('gets status', () => {
      expect(instance.getStatus()).to.equal('REGISTERED');
    });

    it('sets status', () => {
      instance.setStatus('BLOCKED');
      expect(instance.getStatus()).to.equal('BLOCKED');
    });
  });

  describe('provider', () => {
    it('gets provider', () => {
      expect(instance.getProvider()).to.equal('IMS');
    });

    it('sets provider', () => {
      instance.setProvider('GOOGLE');
      expect(instance.getProvider()).to.equal('GOOGLE');
    });
  });

  describe('lastSeenAt', () => {
    it('gets lastSeenAt', () => {
      expect(instance.getLastSeenAt()).to.equal('2024-01-15T10:30:00.000Z');
    });

    it('sets lastSeenAt', () => {
      instance.setLastSeenAt('2024-01-16T10:30:00.000Z');
      expect(instance.getLastSeenAt()).to.equal('2024-01-16T10:30:00.000Z');
    });
  });

  describe('emailId', () => {
    it('gets emailId', () => {
      expect(instance.getEmailId()).to.equal('user1@example.com');
    });

    it('sets emailId', () => {
      instance.setEmailId('new-email@example.com');
      expect(instance.getEmailId()).to.equal('new-email@example.com');
    });
  });

  describe('firstName', () => {
    it('gets firstName', () => {
      expect(instance.getFirstName()).to.equal('John');
    });

    it('sets firstName', () => {
      instance.setFirstName('Jane');
      expect(instance.getFirstName()).to.equal('Jane');
    });
  });

  describe('lastName', () => {
    it('gets lastName', () => {
      expect(instance.getLastName()).to.equal('Doe');
    });

    it('sets lastName', () => {
      instance.setLastName('Smith');
      expect(instance.getLastName()).to.equal('Smith');
    });
  });

  describe('metadata', () => {
    it('gets metadata', () => {
      expect(instance.getMetadata()).to.deep.equal({
        signupSource: 'email',
        preferences: {
          notifications: true,
        },
      });
    });

    it('sets metadata', () => {
      const newMetadata = { signupSource: 'google', preferences: { notifications: false } };
      instance.setMetadata(newMetadata);
      expect(instance.getMetadata()).to.deep.equal(newMetadata);
    });
  });
});
