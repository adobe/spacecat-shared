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

import { stub } from 'sinon';
import { createElectroMocks } from '../../util.js';
import projectsFixture from '../../../fixtures/projects.fixture.js';
import { Project } from '../../../../src/index.js';

describe('Project Model', () => {
  let project;
  const mockRecord = projectsFixture[0];

  let mockElectroService;

  beforeEach(() => {
    ({
      mockElectroService,
      model: project,
    } = createElectroMocks(Project, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('getProjectName', () => {
    it('should return the project name', () => {
      expect(project).to.be.an('object');
      expect(project.getProjectName()).to.equal('Test Project 1');
    });
  });

  describe('getOrganizationId', () => {
    it('should return the organization ID', () => {
      expect(project.getOrganizationId()).to.equal('4854e75e-894b-4a74-92bf-d674abad1423');
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

  describe('getPrimaryLocaleSites', () => {
    it('should return an empty array when no sites exist', async () => {
      project.getSites = stub().resolves([]);

      const result = await project.getPrimaryLocaleSites();

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });

    it('should return only sites where getPrimaryLocale is true', async () => {
      const mockSite1 = {
        getIsPrimaryLocale: stub().returns(false),
        getBaseURL: () => 'https://example1.com',
      };
      const mockSite2 = {
        getIsPrimaryLocale: stub().returns(true),
        getBaseURL: () => 'https://example2.com',
      };
      const mockSite3 = {
        getIsPrimaryLocale: stub().returns(false),
        getBaseURL: () => 'https://example3.com',
      };
      const mockSite4 = {
        getIsPrimaryLocale: stub().returns(undefined),
        getBaseURL: () => 'https://example4.com',
      };

      project.getSites = stub().resolves([mockSite1, mockSite2, mockSite3, mockSite4]);

      const result = await project.getPrimaryLocaleSites();

      expect(result).to.deep.equal([mockSite2]);
    });
  });
});
