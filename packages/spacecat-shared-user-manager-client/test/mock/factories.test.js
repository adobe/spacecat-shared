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
  createWorkspaceMock,
  createWorkspaceStatusMock,
  createWorkspaceDeleteResponseMock,
  createBasicResponseMock,
  createWorkspaceResourcesMock,
} from '../../mock/factories.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('mock factories', () => {
  it('createWorkspaceMock — realistic defaults + override', () => {
    const ws = createWorkspaceMock();
    expect(ws.id).to.match(UUID_RE);
    expect(ws).to.include({ title: 'Seeded Workspace', status: 'created', parent_id: '' });
    expect(ws.products).to.deep.equal(['ai']);
    const overridden = createWorkspaceMock({
      id: 'w1', title: 'Brand', parent_id: 'p', status: 'not ready',
    });
    expect(overridden).to.include({
      id: 'w1', title: 'Brand', parent_id: 'p', status: 'not ready',
    });
  });

  it('createWorkspaceStatusMock — { status }', () => {
    expect(createWorkspaceStatusMock()).to.deep.equal({ status: 'created' });
    expect(createWorkspaceStatusMock({ status: 'not ready' })).to.deep.equal({ status: 'not ready' });
  });

  it('createWorkspaceDeleteResponseMock — { id }', () => {
    expect(createWorkspaceDeleteResponseMock().id).to.match(UUID_RE);
    expect(createWorkspaceDeleteResponseMock({ id: 'w1' })).to.deep.equal({ id: 'w1' });
  });

  it('createBasicResponseMock — message envelope', () => {
    expect(createBasicResponseMock()).to.deep.equal({ message: '' });
    expect(createBasicResponseMock({ message: 'insufficient available units' }))
      .to.deep.equal({ message: 'insufficient available units' });
  });

  it('createWorkspaceResourcesMock — NewWorkspaceResources shape, zeroed defaults + overrides', () => {
    const zeroed = createWorkspaceResourcesMock();
    expect(zeroed.product_resources.ai.tier).to.deep.equal({ id: 'gold', name: 'gold', rank: 30 });
    expect(zeroed.product_resources.ai.resources).to.deep.equal({
      projects: { used: 0, drafted: 0, total: 0 },
      prompts: { used: 0, drafted: 0, total: 0 },
      weekly_prompts: { used: 0, drafted: 0, total: 0 },
    });
    expect(zeroed.general.resources)
      .to.have.all.keys('users', 'service_credits', 'api_units', 'service_units');
    const custom = createWorkspaceResourcesMock({
      projects: { used: 2, total: 13 },
      prompts: { total: 800 },
      tier: { id: 'platinum', name: 'platinum', rank: 40 },
    });
    const r = custom.product_resources.ai.resources;
    expect(r.projects).to.deep.equal({ used: 2, drafted: 0, total: 13 });
    expect(r.prompts).to.deep.equal({ used: 0, drafted: 0, total: 800 });
    expect(custom.product_resources.ai.tier.id).to.equal('platinum');
  });
});
