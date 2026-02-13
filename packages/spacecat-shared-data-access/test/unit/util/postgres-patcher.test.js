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

/* eslint-env mocha */

import { expect, use as chaiUse } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import PostgresPatcher from '../../../src/util/postgres-patcher.js';

chaiUse(chaiAsPromised);

describe('PostgresPatcher', () => {
  let patcher;
  let mockCollection;
  let mockSchema;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      testEntityId: 'test-id-1',
      name: 'Test Entity',
      status: 'active',
      age: 25,
      isActive: true,
      metadata: { key: 'value' },
      tags: ['tag1'],
      nickNames: ['nick1'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    mockSchema = {
      getEntityName: () => 'testEntity',
      getModelName: () => 'TestEntity',
      getIdName: () => 'testEntityId',
      allowsUpdates: () => true,
      allowsRemove: () => true,
      getAttribute: (name) => {
        const attrs = {
          testEntityId: { type: 'string', required: true },
          name: { type: 'string', required: true },
          status: { type: 'string' },
          age: { type: 'number' },
          isActive: { type: 'boolean' },
          metadata: { type: 'map' },
          tags: { type: 'set', items: { type: 'string' } },
          nickNames: { type: 'list', items: { type: 'string' } },
          profile: { type: 'any' },
          readOnlyField: { type: 'string', readOnly: true },
          createdAt: { type: 'string', readOnly: true },
          updatedAt: { type: 'string', readOnly: true },
        };
        return attrs[name];
      },
      getAttributes: () => ({
        testEntityId: { type: 'string', required: true },
        name: { type: 'string', required: true },
        status: { type: 'string' },
      }),
      getIndexKeys: (indexName) => {
        if (indexName === 'primary') return ['testEntityId'];
        return [];
      },
    };

    mockCollection = {
      applyUpdateWatchers: sinon.stub().callsFake((record, updates) => ({
        record,
        updates,
      })),
      updateByKeys: sinon.stub().resolves(),
    };

    patcher = new PostgresPatcher(mockCollection, mockSchema, mockRecord);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('patchValue', () => {
    it('tracks string changes', () => {
      patcher.patchValue('name', 'Updated Name');

      expect(patcher.hasUpdates()).to.be.true;
      const updates = patcher.getUpdates();
      expect(updates.name.previous).to.equal('Test Entity');
      expect(updates.name.current).to.equal('Updated Name');
      expect(mockRecord.name).to.equal('Updated Name');
    });

    it('tracks number changes', () => {
      patcher.patchValue('age', 30);

      expect(patcher.getUpdates().age.current).to.equal(30);
    });

    it('tracks boolean changes', () => {
      patcher.patchValue('isActive', false);

      expect(patcher.getUpdates().isActive.current).to.equal(false);
    });

    it('tracks map changes', () => {
      const newMeta = { key: 'new-value' };
      patcher.patchValue('metadata', newMeta);

      expect(patcher.getUpdates().metadata.current).to.deep.equal(newMeta);
    });

    it('tracks set changes', () => {
      patcher.patchValue('tags', ['tag1', 'tag2']);

      expect(patcher.getUpdates().tags.current).to.deep.equal(['tag1', 'tag2']);
    });

    it('tracks list changes', () => {
      patcher.patchValue('nickNames', ['nick1', 'nick2']);

      expect(patcher.getUpdates().nickNames.current).to.deep.equal(['nick1', 'nick2']);
    });

    it('tracks any type changes', () => {
      patcher.patchValue('profile', { anything: 'goes' });

      expect(patcher.getUpdates().profile.current).to.deep.equal({ anything: 'goes' });
    });

    it('throws for read-only attributes', () => {
      expect(() => patcher.patchValue('readOnlyField', 'new'))
        .to.throw('read-only');
    });

    it('throws for non-existent attributes', () => {
      expect(() => patcher.patchValue('nonExistent', 'value'))
        .to.throw('does not exist');
    });

    it('throws when updates not allowed', () => {
      mockSchema.allowsUpdates = () => false;
      patcher = new PostgresPatcher(mockCollection, mockSchema, mockRecord);

      expect(() => patcher.patchValue('name', 'New'))
        .to.throw('Updates prohibited');
    });

    it('validates reference IDs', () => {
      // Should accept a valid UUID
      patcher.patchValue('name', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', true);
      expect(patcher.hasUpdates()).to.be.true;
    });

    it('validates enum type (array type)', () => {
      // Mock an attribute with array type (enum shorthand)
      mockSchema.getAttribute = (name) => {
        if (name === 'status') return { type: ['active', 'inactive'] };
        return { type: 'string', required: true };
      };
      patcher = new PostgresPatcher(mockCollection, mockSchema, mockRecord);

      patcher.patchValue('status', 'active');
      expect(patcher.getUpdates().status.current).to.equal('active');
    });

    it('throws for unsupported type', () => {
      mockSchema.getAttribute = (name) => {
        if (name === 'status') return { type: 'unknown_type' };
        return { type: 'string', required: true };
      };
      patcher = new PostgresPatcher(mockCollection, mockSchema, mockRecord);

      expect(() => patcher.patchValue('status', 'value'))
        .to.throw('Unsupported type');
    });
  });

  describe('hasUpdates', () => {
    it('returns false when clean', () => {
      expect(patcher.hasUpdates()).to.be.false;
    });

    it('returns true after a change', () => {
      patcher.patchValue('name', 'Changed');
      expect(patcher.hasUpdates()).to.be.true;
    });
  });

  describe('getUpdates', () => {
    it('returns empty object when clean', () => {
      expect(patcher.getUpdates()).to.deep.equal({});
    });
  });

  describe('save', () => {
    it('calls collection.updateByKeys with tracked updates', async () => {
      patcher.patchValue('name', 'Updated Name');

      await patcher.save();

      expect(mockCollection.applyUpdateWatchers.calledOnce).to.be.true;
      expect(mockCollection.updateByKeys.calledOnce).to.be.true;

      const [keys, updates] = mockCollection.updateByKeys.firstCall.args;
      expect(keys).to.deep.equal({ testEntityId: 'test-id-1' });
      expect(updates.name).to.equal('Updated Name');
      expect(updates.updatedAt).to.be.a('string');
    });

    it('does nothing when no updates', async () => {
      await patcher.save();

      expect(mockCollection.updateByKeys.called).to.be.false;
    });

    it('updates the updatedAt timestamp', async () => {
      patcher.patchValue('name', 'Changed');

      await patcher.save();

      expect(patcher.getUpdates().updatedAt).to.exist;
      expect(patcher.getUpdates().updatedAt.previous).to.equal('2026-01-01T00:00:00.000Z');
    });

    it('throws when updates not allowed', async () => {
      patcher.patchValue('name', 'Changed');
      mockSchema.allowsUpdates = () => false;

      await expect(patcher.save()).to.be.rejectedWith('Updates prohibited');
    });
  });
});
