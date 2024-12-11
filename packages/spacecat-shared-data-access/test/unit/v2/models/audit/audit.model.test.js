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

import Audit, { validateAuditResult } from '../../../../../src/v2/models/audit/audit.model.js';
import AuditSchema from '../../../../../src/v2/models/audit/audit.schema.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const { attributes } = new Entity(AuditSchema).model.schema;

describe('Audit', () => {
  let auditInstance;
  let mockElectroService;
  let mockModelFactory;
  let mockRecord;
  let mockLogger;

  beforeEach(() => {
    mockElectroService = {
      entities: {
        audit: {
          model: {
            name: 'audit',
            schema: { attributes },
            original: {
              references: {},
            },
            indexes: {
              primary: {
                pk: {
                  field: 'pk',
                  composite: ['auditId'],
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
      auditId: 'a12345',
      auditResult: { foo: 'bar' },
      auditType: 'someAuditType',
      auditedAt: '2024-01-01T00:00:00.000Z',
      fullAuditRef: 'someFullAuditRef',
      isLive: true,
      isError: false,
      siteId: 'site12345',
    };

    auditInstance = new Audit(
      mockElectroService,
      mockModelFactory,
      mockRecord,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the Audit instance correctly', () => {
      expect(auditInstance).to.be.an('object');
      expect(auditInstance.record).to.deep.equal(mockRecord);
    });
  });

  describe('auditId', () => {
    it('gets auditId', () => {
      expect(auditInstance.getId()).to.equal('a12345');
    });
  });

  describe('auditResult', () => {
    it('gets auditResult', () => {
      expect(auditInstance.getAuditResult()).to.deep.equal({ foo: 'bar' });
    });

    it('sets auditResult', () => {
      const newAuditResult = { bar: 'baz' };
      auditInstance.setAuditResult(newAuditResult);
      expect(auditInstance.getAuditResult()).to.deep.equal(newAuditResult);
    });
  });

  describe('auditType', () => {
    it('gets auditType', () => {
      expect(auditInstance.getAuditType()).to.equal('someAuditType');
    });

    it('sets auditType', () => {
      const newAuditType = 'someNewAuditType';
      auditInstance.setAuditType(newAuditType);
      expect(auditInstance.getAuditType()).to.equal(newAuditType);
    });
  });

  describe('auditedAt', () => {
    it('gets auditedAt', () => {
      expect(auditInstance.getAuditedAt()).to.equal('2024-01-01T00:00:00.000Z');
    });

    it('sets auditedAt', () => {
      const newAuditedAt = '2024-01-02T00:00:00.000Z';
      auditInstance.setAuditedAt(newAuditedAt);
      expect(auditInstance.getAuditedAt()).to.equal(newAuditedAt);
    });
  });

  describe('fullAuditRef', () => {
    it('gets fullAuditRef', () => {
      expect(auditInstance.getFullAuditRef()).to.equal('someFullAuditRef');
    });

    it('sets fullAuditRef', () => {
      const newFullAuditRef = 'someNewFullAuditRef';
      auditInstance.setFullAuditRef(newFullAuditRef);
      expect(auditInstance.getFullAuditRef()).to.equal(newFullAuditRef);
    });
  });

  describe('isLive', () => {
    it('gets isLive', () => {
      expect(auditInstance.getIsLive()).to.be.true;
    });

    it('sets isLive', () => {
      auditInstance.setIsLive(false);
      expect(auditInstance.getIsLive()).to.be.false;
    });
  });

  describe('isError', () => {
    it('gets isError', () => {
      expect(auditInstance.getIsError()).to.be.false;
    });

    it('sets isError', () => {
      auditInstance.setIsError(true);
      expect(auditInstance.getIsError()).to.be.true;
    });
  });

  describe('siteId', () => {
    it('gets siteId', () => {
      expect(auditInstance.getSiteId()).to.equal('site12345');
    });

    it('sets siteId', () => {
      const newSiteId = 'site67890';
      auditInstance.setSiteId(newSiteId);
      expect(auditInstance.getSiteId()).to.equal(newSiteId);
    });
  });

  describe('getScores', () => {
    it('returns the scores from the audit result', () => {
      mockRecord.auditResult = { scores: { foo: 'bar' } };
      expect(auditInstance.getScores()).to.deep.equal({ foo: 'bar' });
    });
  });

  describe('validateAuditResult', () => {
    it('throws an error if auditResult is not an object or array', () => {
      expect(() => validateAuditResult(null, 'someAuditType'))
        .to.throw('Audit result must be an object or array');
    });

    it('throws an error if auditResult is an object and does not contain scores', () => {
      expect(() => validateAuditResult({ foo: 'bar' }, 'lhs-mobile'))
        .to.throw("Missing scores property for audit type 'lhs-mobile'");
    });

    it('throws an error if auditResult is an object and does not contain expected properties', () => {
      mockRecord.auditResult = { scores: { foo: 'bar' } };
      expect(() => validateAuditResult(mockRecord.auditResult, 'lhs-desktop'))
        .to.throw("Missing expected property 'performance' for audit type 'lhs-desktop'");
    });

    it('returns true if the auditResult represents a runtime error', () => {
      mockRecord.auditResult = { runtimeError: { code: 'someErrorCode' } };
      expect(validateAuditResult(mockRecord.auditResult, 'someAuditType')).to.be.true;
    });

    it('returns true if auditResult is an object and contains expected properties', () => {
      mockRecord.auditResult = {
        scores: {
          performance: 1, seo: 1, accessibility: 1, 'best-practices': 1,
        },
      };
      expect(validateAuditResult(mockRecord.auditResult, 'lhs-mobile')).to.be.true;
    });
  });
});
