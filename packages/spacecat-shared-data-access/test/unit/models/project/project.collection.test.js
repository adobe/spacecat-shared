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
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import { createElectroMocks } from '../../util.js';
import projectsFixture from '../../../fixtures/projects.fixture.js';
import { Project } from '../../../../src/index.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('ProjectCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = projectsFixture[0];

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Project, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the ProjectCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('allByOrganizationId', () => {
    it('returns all projects for an organization', async () => {
      const mockProjects = [
        { getId: () => 'p12345', getOrganizationId: () => 'org123' },
        { getId: () => 'p67890', getOrganizationId: () => 'org123' },
      ];
      instance.allByOrganizationId = stub().resolves(mockProjects);

      const result = await instance.allByOrganizationId('org123');

      expect(result).to.deep.equal(mockProjects);
      expect(instance.allByOrganizationId).to.have.been.calledOnceWithExactly('org123');
    });

    it('returns empty array when no projects found for organization', async () => {
      instance.allByOrganizationId = stub().resolves([]);

      const result = await instance.allByOrganizationId('nonexistent-org');

      expect(result).to.deep.equal([]);
      expect(instance.allByOrganizationId).to.have.been.calledOnceWithExactly('nonexistent-org');
    });

    it('throws error for empty organization ID', async () => {
      instance.allByOrganizationId = stub().rejects(new Error('organizationId is required'));

      await expect(instance.allByOrganizationId('')).to.be.rejectedWith('organizationId is required');
      await expect(instance.allByOrganizationId(null)).to.be.rejectedWith('organizationId is required');
      await expect(instance.allByOrganizationId(undefined)).to.be.rejectedWith('organizationId is required');
    });
  });

  describe('allByProjectName', () => {
    it('returns all projects with the specified name', async () => {
      const mockProjects = [
        { getId: () => 'p12345', getProjectName: () => 'Test Project' },
      ];
      instance.allByProjectName = stub().resolves(mockProjects);

      const result = await instance.allByProjectName('Test Project');

      expect(result).to.deep.equal(mockProjects);
      expect(instance.allByProjectName).to.have.been.calledOnceWithExactly('Test Project');
    });

    it('returns empty array when no projects found with the name', async () => {
      instance.allByProjectName = stub().resolves([]);

      const result = await instance.allByProjectName('Nonexistent Project');

      expect(result).to.deep.equal([]);
      expect(instance.allByProjectName).to.have.been.calledOnceWithExactly('Nonexistent Project');
    });

    it('throws error for empty project name', async () => {
      instance.allByProjectName = stub().rejects(new Error('projectName is required'));

      await expect(instance.allByProjectName('')).to.be.rejectedWith('projectName is required');
      await expect(instance.allByProjectName(null)).to.be.rejectedWith('projectName is required');
      await expect(instance.allByProjectName(undefined)).to.be.rejectedWith('projectName is required');
    });
  });

  describe('findByProjectName', () => {
    it('returns a single project with the specified name', async () => {
      const mockProject = { getId: () => 'p12345', getProjectName: () => 'Test Project' };
      instance.findByProjectName = stub().resolves(mockProject);

      const result = await instance.findByProjectName('Test Project');

      expect(result).to.deep.equal(mockProject);
      expect(instance.findByProjectName).to.have.been.calledOnceWithExactly('Test Project');
    });

    it('returns null when no project found with the name', async () => {
      instance.findByProjectName = stub().resolves(null);

      const result = await instance.findByProjectName('Nonexistent Project');

      expect(result).to.be.null;
      expect(instance.findByProjectName).to.have.been.calledOnceWithExactly('Nonexistent Project');
    });

    it('throws error for empty project name', async () => {
      instance.findByProjectName = stub().rejects(new Error('projectName is required'));

      await expect(instance.findByProjectName('')).to.be.rejectedWith('projectName is required');
      await expect(instance.findByProjectName(null)).to.be.rejectedWith('projectName is required');
      await expect(instance.findByProjectName(undefined)).to.be.rejectedWith('projectName is required');
    });
  });

  describe('findByOrganizationIdAndProjectName', () => {
    it('returns a project when both organization ID and project name match', async () => {
      const mockProject = {
        getId: () => 'p12345',
        getOrganizationId: () => 'org123',
        getProjectName: () => 'Test Project',
      };
      instance.findByOrganizationIdAndProjectName = stub().resolves(mockProject);

      const result = await instance.findByOrganizationIdAndProjectName('org123', 'Test Project');

      expect(result).to.deep.equal(mockProject);
      expect(instance.findByOrganizationIdAndProjectName)
        .to.have.been.calledOnceWithExactly('org123', 'Test Project');
    });

    it('returns null when no project found with the criteria', async () => {
      instance.findByOrganizationIdAndProjectName = stub().resolves(null);

      const result = await instance.findByOrganizationIdAndProjectName('org123', 'Nonexistent Project');

      expect(result).to.be.null;
      expect(instance.findByOrganizationIdAndProjectName)
        .to.have.been.calledOnceWithExactly('org123', 'Nonexistent Project');
    });

    it('throws error for empty organization ID', async () => {
      instance.findByOrganizationIdAndProjectName = stub()
        .rejects(new Error('organizationId is required'));

      await expect(instance.findByOrganizationIdAndProjectName('', 'Test Project'))
        .to.be.rejectedWith('organizationId is required');
    });

    it('throws error for empty project name', async () => {
      instance.findByOrganizationIdAndProjectName = stub()
        .rejects(new Error('projectName is required'));

      await expect(instance.findByOrganizationIdAndProjectName('org123', ''))
        .to.be.rejectedWith('projectName is required');
    });
  });
});
