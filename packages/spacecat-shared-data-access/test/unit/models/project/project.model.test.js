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

import { expect } from 'chai';

import { Project } from '../../../../src/models/project/index.js';
import { createElectroMocks } from '../../util.js';

describe('Project Model', () => {
  let project;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      projectId: 'test-project-id',
      projectName: 'Test Project',
      organizationId: 'test-org-id',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    ({
      model: project,
    } = createElectroMocks(Project, mockRecord));
  });

  describe('getProjectName', () => {
    it('should return the project name', () => {
      expect(project.getProjectName()).to.equal('Test Project');
    });
  });

  describe('getOrganizationId', () => {
    it('should return the organization ID', () => {
      expect(project.getOrganizationId()).to.equal('test-org-id');
    });
  });

  describe('setProjectName', () => {
    it('should set the project name and return the instance', () => {
      const result = project.setProjectName('New Project Name');
      expect(result).to.equal(project);
      expect(project.getProjectName()).to.equal('New Project Name');
    });
  });

  describe('setOrganizationId', () => {
    it('should set the organization ID and return the instance', () => {
      const result = project.setOrganizationId('1e9c6f94-f226-41f3-9005-4bb766765ac2');
      expect(result).to.equal(project);
      expect(project.getOrganizationId()).to.equal('1e9c6f94-f226-41f3-9005-4bb766765ac2');
    });
  });
});
