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

import KeyEvent from '../../../../../src/v2/models/key-event/key-event.model.js';
import KeyEventSchema from '../../../../../src/v2/models/key-event/key-event.schema.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const { attributes } = new Entity(KeyEventSchema).model.schema;

describe('KeyEvent', () => {
  let keyEventInstance;
  let mockElectroService;
  let mockModelFactory;
  let mockRecord;
  let mockLogger;

  beforeEach(() => {
    mockElectroService = {
      entities: {
        keyEvent: {
          model: {
            name: 'keyEvent',
            schema: { attributes },
            original: {
              references: {},
            },
            indexes: {
              primary: {
                pk: {
                  field: 'pk',
                  composite: ['keyEventId'],
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
      keyEventId: 'k12345',
      siteId: 's12345',
      name: 'someName',
      type: 'CONTENT',
      time: '2022-01-01T00:00:00.000Z',
    };

    keyEventInstance = new KeyEvent(
      mockElectroService,
      mockModelFactory,
      mockRecord,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the KeyEvent instance correctly', () => {
      expect(keyEventInstance).to.be.an('object');
      expect(keyEventInstance.record).to.deep.equal(mockRecord);
    });
  });

  describe('keyEventId', () => {
    it('gets keyEventId', () => {
      expect(keyEventInstance.getId()).to.equal('k12345');
    });
  });

  describe('siteId', () => {
    it('gets siteId', () => {
      expect(keyEventInstance.getSiteId()).to.equal('s12345');
    });

    it('sets siteId', () => {
      keyEventInstance.setSiteId('newSiteId');
      expect(keyEventInstance.getSiteId()).to.equal('newSiteId');
    });
  });

  describe('name', () => {
    it('gets name', () => {
      expect(keyEventInstance.getName()).to.equal('someName');
    });

    it('sets name', () => {
      keyEventInstance.setName('newName');
      expect(keyEventInstance.getName()).to.equal('newName');
    });
  });

  describe('type', () => {
    it('gets type', () => {
      expect(keyEventInstance.getType()).to.equal('CONTENT');
    });

    it('sets type', () => {
      keyEventInstance.setType('STATUS CHANGE');
      expect(keyEventInstance.getType()).to.equal('STATUS CHANGE');
    });
  });

  describe('time', () => {
    it('gets time', () => {
      expect(keyEventInstance.getTime()).to.equal('2022-01-01T00:00:00.000Z');
    });

    it('sets time', () => {
      const newTime = '2023-01-01T00:00:00.000Z';
      keyEventInstance.setTime(newTime);
      expect(keyEventInstance.getTime()).to.equal(newTime);
    });
  });
});
