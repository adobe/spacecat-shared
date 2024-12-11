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

import AuditCollection from '../../../../../src/v2/models/audit/audit.collection.js';
import Audit from '../../../../../src/v2/models/audit/audit.model.js';
import AuditSchema from '../../../../../src/v2/models/audit/audit.schema.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const { attributes } = new Entity(AuditSchema).model.schema;

let mockElectroService;

describe('AuditCollection', () => {
  let instance;
  let mockAuditModel;
  let mockLogger;
  let mockEntityRegistry;

  const mockRecord = {
    auditId: 's12345',
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
        },
      },
    };

    mockAuditModel = new Audit(
      mockElectroService,
      mockEntityRegistry,
      mockRecord,
      mockLogger,
    );

    instance = new AuditCollection(
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the AuditCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.log).to.equal(mockLogger);

      expect(mockAuditModel).to.be.an('object');
    });
  });
});
