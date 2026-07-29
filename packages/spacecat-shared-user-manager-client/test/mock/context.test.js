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

import { expect } from 'chai';
import {
  mkdtempSync, writeFileSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '../../mock/context.js';
import { SEED_IDS, buildSeed } from '../../mock/seeds.js';
import { authError } from '../../mock/auth.js';

describe('mock Context', () => {
  const { parentWorkspaceId, childWorkspaceId } = SEED_IDS;

  it('loads the default seed and exposes the stateful ops + wired helpers', () => {
    const ctx = new Context();
    expect(ctx.seedName).to.equal('parent-with-child');
    expect(ctx.ops.workspaces.list()).to.have.length(2);
    // the quota + auth + factory layers are wired onto the context
    expect(ctx.quota).to.be.an('object');
    expect(ctx.authError).to.equal(authError);
    expect(ctx.factories.createWorkspaceMock).to.be.a('function');
  });

  it('selects a named seed', () => {
    const ctx = new Context({ seed: 'empty-parent' });
    expect(ctx.seedName).to.equal('empty-parent');
    expect(ctx.ops.workspaces.list()).to.have.length(1);
  });

  it('falls back to the default seed for an unknown name', () => {
    const ctx = new Context({ seed: 'does-not-exist' });
    expect(ctx.seedName).to.equal('parent-with-child');
  });

  it('reset() restores the seed after mutation', () => {
    const ctx = new Context();
    ctx.ops.workspaces.remove(childWorkspaceId);
    expect(ctx.ops.workspaces.list()).to.have.length(1);
    ctx.reset();
    expect(ctx.ops.workspaces.list()).to.have.length(2);
  });

  it('seed() replaces state and becomes the new reset baseline', () => {
    const ctx = new Context({ seed: 'empty-parent' });
    ctx.seed(buildSeed({ workspaces: [{ id: 'ws-99', title: 'Seeded', parentId: '' }] }));
    expect(ctx.ops.workspaces.list().map((w) => w.id)).to.deep.equal(['ws-99']);
    // mutate, then reset → returns to the seeded baseline, not the boot seed.
    ctx.ops.workspaces.create(ctx.factories.createWorkspaceMock({ id: 'ws-tmp', parent_id: 'ws-99' }));
    expect(ctx.ops.workspaces.list()).to.have.length(2);
    ctx.reset();
    expect(ctx.ops.workspaces.list().map((w) => w.id)).to.deep.equal(['ws-99']);
  });

  it('dump() returns the current live state', () => {
    const ctx = new Context();
    const snapshot = ctx.dump();
    expect(snapshot.workspaces.map((w) => w.id))
      .to.have.members([parentWorkspaceId, childWorkspaceId]);
  });

  describe('seedFile boot', () => {
    let dir;
    let seedFile;

    before(() => {
      dir = mkdtempSync(join(tmpdir(), 'um-mock-seed-'));
      seedFile = join(dir, 'seed.json');
      writeFileSync(seedFile, JSON.stringify(buildSeed({
        workspaces: [{ id: 'ws-file', title: 'From file', parentId: '' }],
      })));
    });

    after(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('loads a JSON Snapshot file in preference to a named seed', () => {
      const ctx = new Context({ seed: 'parent-with-child', seedFile });
      expect(ctx.seedName).to.equal(null);
      expect(ctx.ops.workspaces.list().map((w) => w.id)).to.deep.equal(['ws-file']);
    });
  });
});
