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

import { expect } from 'chai';
import {
  mkdtempSync, writeFileSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '../../mock/context.js';
import { SEED_IDS, buildSeed } from '../../mock/seeds.js';

describe('mock Context', () => {
  const { workspaceId, projectId } = SEED_IDS;

  it('loads the default seed and exposes stateful ops', () => {
    const ctx = new Context();
    expect(ctx.seedName).to.equal('workspace-with-data');
    expect(ctx.ops.projects.list({ workspaceId })).to.have.length(1);
  });

  it('exposes the language catalog for the GET /v1/languages route', () => {
    const ctx = new Context();
    expect(ctx.languageCatalog).to.be.an('array').with.length(38);
    expect(ctx.languageCatalog).to.deep.include({
      id: '5a0a33ed-7f5c-4901-befd-a042c0350da1', name: 'English', iso: 'en',
    });
  });

  it('selects a named seed', () => {
    const ctx = new Context({ seed: 'empty-workspace' });
    expect(ctx.seedName).to.equal('empty-workspace');
    expect(ctx.ops.projects.list({ workspaceId })).to.have.length(0);
  });

  it('falls back to the default seed for an unknown name', () => {
    const ctx = new Context({ seed: 'does-not-exist' });
    expect(ctx.seedName).to.equal('workspace-with-data');
  });

  it('reset() restores the seed after mutation', () => {
    const ctx = new Context();
    ctx.ops.prompts.createMany({ workspaceId, projectId }, [{ text: 'extra' }]);
    expect(ctx.ops.prompts.list({ workspaceId, projectId })).to.have.length(2);
    ctx.reset();
    expect(ctx.ops.prompts.list({ workspaceId, projectId })).to.have.length(1);
  });

  it('seed() replaces state and becomes the new reset baseline', () => {
    const ctx = new Context({ seed: 'empty-workspace' });
    ctx.seed(buildSeed({
      workspaceId: 'ws-99',
      projects: [{ id: 'pr-99', name: 'Seeded' }],
    }));
    expect(ctx.ops.projects.list({ workspaceId: 'ws-99' })).to.have.length(1);
    // mutate, then reset → returns to the seeded baseline, not the boot seed.
    ctx.ops.projects.create({ workspaceId: 'ws-99' }, { name: 'transient' });
    expect(ctx.ops.projects.list({ workspaceId: 'ws-99' })).to.have.length(2);
    ctx.reset();
    expect(ctx.ops.projects.list({ workspaceId: 'ws-99' })).to.have.length(1);
  });

  it('dump() returns the current live state', () => {
    const ctx = new Context();
    ctx.ops.projects.create({ workspaceId }, { id: 'pr-extra', name: 'Extra' });
    const snapshot = ctx.dump();
    const projects = snapshot[`projects:${workspaceId}`];
    expect(projects.map((p) => p.id)).to.have.members([projectId, 'pr-extra']);
  });

  describe('seedFile boot', () => {
    let dir;
    let seedFile;

    before(() => {
      dir = mkdtempSync(join(tmpdir(), 'pe-mock-seed-'));
      seedFile = join(dir, 'seed.json');
      writeFileSync(seedFile, JSON.stringify(buildSeed({
        workspaceId: 'ws-file',
        projects: [{ id: 'pr-file', name: 'From file' }],
      })));
    });

    after(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('loads a JSON Snapshot file in preference to a named seed', () => {
      const ctx = new Context({ seed: 'workspace-with-data', seedFile });
      expect(ctx.seedName).to.equal(null);
      expect(ctx.ops.projects.list({ workspaceId: 'ws-file' })).to.have.length(1);
      // the named seed was NOT loaded.
      expect(ctx.ops.projects.list({ workspaceId })).to.have.length(0);
    });
  });
});
