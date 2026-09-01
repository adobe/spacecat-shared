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
  pauseTransition,
  resumeTransition,
  NOT_FOUND_MESSAGE,
  NOT_PAUSED_MESSAGE,
} from '../../mock/pause.js';
import { createProjectMock } from '../../mock/factories.js';

// The live branch table (prod, 2026-08-24, workspace 0a496c87-… project 997e17c3-…):
// pause running → 202 | pause paused → 202 (idempotent) | resume paused → 202
// resume running → 409 "project is not paused" | either, unknown id → 404 "not found"

describe('pause — pauseTransition', () => {
  it('pauses a running project (202, is_paused → true)', () => {
    const project = createProjectMock({ is_paused: false });
    expect(pauseTransition(project)).to.deep.equal({ status: 202, patch: { is_paused: true } });
  });

  it('is IDEMPOTENT: pausing an already-paused project acks again, never conflicts', () => {
    const project = createProjectMock({ is_paused: true });
    expect(pauseTransition(project)).to.deep.equal({ status: 202, patch: { is_paused: true } });
  });

  it('404s an unknown project id with the live body', () => {
    expect(pauseTransition(undefined)).to.deep.equal({ status: 404, message: NOT_FOUND_MESSAGE });
    expect(NOT_FOUND_MESSAGE).to.equal('not found');
  });
});

describe('pause — resumeTransition', () => {
  it('resumes a paused project (202, is_paused → false)', () => {
    const project = createProjectMock({ is_paused: true });
    expect(resumeTransition(project)).to.deep.equal({ status: 202, patch: { is_paused: false } });
  });

  it('is NOT idempotent: resuming a running project is the live 409', () => {
    const project = createProjectMock({ is_paused: false });
    expect(resumeTransition(project)).to.deep.equal({ status: 409, message: NOT_PAUSED_MESSAGE });
    expect(NOT_PAUSED_MESSAGE).to.equal('project is not paused');
  });

  it('treats an absent is_paused as running (409), so a pre-CR23 seed cannot resume', () => {
    expect(resumeTransition({ id: 'p-1' })).to.deep.equal({
      status: 409, message: NOT_PAUSED_MESSAGE,
    });
  });

  it('404s an unknown project id with the live body', () => {
    expect(resumeTransition(undefined)).to.deep.equal({ status: 404, message: NOT_FOUND_MESSAGE });
  });
});

describe('pause — the factory default', () => {
  it('every project the factory builds carries is_paused (required per CR23/CR5)', () => {
    expect(createProjectMock()).to.have.property('is_paused', false);
  });

  it('the default is overridable, so a seed can start a project paused', () => {
    expect(createProjectMock({ is_paused: true })).to.have.property('is_paused', true);
  });
});
