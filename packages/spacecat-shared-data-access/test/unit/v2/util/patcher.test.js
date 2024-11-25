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
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import Patcher from '../../../../src/v2/util/patcher.js';

chaiUse(chaiAsPromised);

describe('Patcher', () => {
  let patcher;
  let mockEntity;
  let mockRecord;

  beforeEach(() => {
    mockEntity = {
      model: {
        name: 'TestEntity',
        schema: {
          attributes: {
            name: { type: 'string' },
            age: { type: 'number' },
            tags: { type: 'set', items: { type: 'string' } },
            status: { type: 'enum', enumArray: ['active', 'inactive'] },
            referenceId: { type: 'string' },
            metadata: { type: 'map' },
            profile: { type: 'any' },
            nickNames: { type: 'list', items: { type: 'string' } },
            settings: { type: 'any', required: true },
          },
        },
        indexes: {
          primaryIndex: {
            pk: { facets: ['testEntityId'] },
            sk: { facets: ['name', 'age'] },
          },
        },
      },
      patch: sinon.stub().returns({
        set: sinon.stub().returnsThis(),
        go: sinon.stub().resolves(),
      }),
    };

    mockRecord = {
      testEntityId: '123',
      name: 'Test',
      age: 25,
      tags: ['tag1', 'tag2'],
      status: 'active',
      referenceId: '456',
    };

    patcher = new Patcher(mockEntity, mockRecord);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('patches a string value', () => {
    patcher.patchValue('name', 'UpdatedName');
    expect(mockEntity.patch().set.calledWith({ name: 'UpdatedName', age: 25 })).to.be.true;
    expect(mockRecord.name).to.equal('UpdatedName');
  });

  it('throws error for read-only property', () => {
    mockEntity.model.schema.attributes.name.readOnly = true;
    expect(() => patcher.patchValue('name', 'NewValue'))
      .to.throw('The property name is read-only and cannot be updated.');
  });

  it('validates an enum attribute', () => {
    patcher.patchValue('status', 'inactive');
    expect(mockRecord.status).to.equal('inactive');
  });

  it('throws error for unsupported enum value', () => {
    expect(() => patcher.patchValue('status', 'unknown'))
      .to.throw('Validation failed in testentity: status must be one of active,inactive');
  });

  it('patches a reference id with proper validation', () => {
    patcher.patchValue('referenceId', 'ef39921f-9a02-41db-b491-02c98987d956', true);
    expect(mockRecord.referenceId).to.equal('ef39921f-9a02-41db-b491-02c98987d956');
  });

  it('throws error for non-existent property', () => {
    expect(() => patcher.patchValue('nonExistent', 'value'))
      .to.throw('Property nonExistent does not exist on entity testentity.');
  });

  it('tracks updates', () => {
    patcher.patchValue('name', 'UpdatedName');

    expect(patcher.hasUpdates()).to.be.true;
    expect(patcher.getUpdates()).to.deep.equal({ name: 'UpdatedName' });
  });

  it('saves the record', async () => {
    patcher.patchValue('name', 'UpdatedName');

    await patcher.save();

    expect(mockEntity.patch().go.calledOnce).to.be.true;
    expect(mockRecord.updatedAt).to.be.a('number');
  });

  it('does not save if there are no updates', async () => {
    await patcher.save();
    expect(mockEntity.patch().go.notCalled).to.be.true;
  });

  it('throws error if attribute type is unsupported', () => {
    mockEntity.model.schema.attributes.invalidType = { type: 'unsupported' };
    expect(() => patcher.patchValue('invalidType', 'value'))
      .to.throw('Unsupported type for property invalidType');
  });

  it('validates and patch a set attribute', () => {
    patcher.patchValue('tags', ['tag3', 'tag4']);
    expect(mockRecord.tags).to.deep.equal(['tag3', 'tag4']);
  });

  it('throws error for invalid set attribute', () => {
    expect(() => patcher.patchValue('tags', ['tag1', 123]))
      .to.throw('Validation failed in testentity: tags must contain items of type string');
  });

  it('validates and patches a number attribute', () => {
    patcher.patchValue('age', 30);
    expect(mockRecord.age).to.equal(30);
  });

  it('throws error for invalid number attribute', () => {
    expect(() => patcher.patchValue('age', 'notANumber'))
      .to.throw('Validation failed in testentity: age must be a number');
  });

  it('validates and patch a map attribute', () => {
    patcher.patchValue('metadata', { newKey: 'newValue' });
    expect(mockRecord.metadata).to.deep.equal({ newKey: 'newValue' });
  });

  it('throws error for invalid map attribute', () => {
    expect(() => patcher.patchValue('metadata', 'notAMap'))
      .to.throw('Validation failed in testentity: metadata must be an object');
  });

  it('validates and patches an any attribute', () => {
    patcher.patchValue('profile', { pic: './ref' });
    expect(mockRecord.profile).to.eql({ pic: './ref' });
  });

  it('throws error for undefined any attribute', () => {
    expect(() => patcher.patchValue('settings', undefined))
      .to.throw('Validation failed in testentity: settings is required');
  });

  it('throws error for null any attribute', () => {
    expect(() => patcher.patchValue('settings', null))
      .to.throw('Validation failed in testentity: settings is required');
  });

  it('validates and patches a list attribute', () => {
    patcher.patchValue('nickNames', ['name1', 'name2']);
    expect(mockRecord.nickNames).to.deep.equal(['name1', 'name2']);
  });

  it('throws error for invalid list attribute', () => {
    expect(() => patcher.patchValue('nickNames', 'notAList'))
      .to.throw('Validation failed in testentity: nickNames must be an array');
  });

  it('throws error for invalid list attribute items', () => {
    expect(() => patcher.patchValue('nickNames', ['name1', 123]))
      .to.throw('Validation failed in testentity: nickNames must contain items of type string');
  });
});
