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
import { Context } from '../../mock/context.js';
import { SEED_IDS } from '../../mock/seeds.js';

describe('mock Context', () => {
  const { workspaceId, projectId } = SEED_IDS;

  it('loads the default seed and exposes stateful ops', () => {
    const ctx = new Context();
    expect(ctx.seedName).to.equal('workspace-with-data');
    expect(ctx.ops.projects.list({ workspaceId })).to.have.length(1);
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
});
