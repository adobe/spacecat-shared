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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { sanitizeIdAndAuditFields, sanitizeTimestamps } from '../../../src/util/util.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

describe('Project IT', async () => {
  let sampleData;
  let Project;
  let Site;

  before(async () => {
    sampleData = await seedDatabase();
    const dataAccess = getDataAccess();
    Project = dataAccess.Project;
    Site = dataAccess.Site;
  });

  it('gets all projects', async () => {
    const projects = await Project.all();

    expect(projects).to.be.an('array');
    expect(projects.length).to.equal(sampleData.projects.length);

    for (let i = 0; i < projects.length; i += 1) {
      const project = projects[i];
      const sampleProject = sampleData.projects[i];

      expect(project).to.be.an('object');
      expect(project.getId()).to.be.a('string');
      expect(project.getProjectName()).to.be.a('string');
      expect(project.getOrganizationId()).to.be.a('string');

      expect(
        sanitizeTimestamps(project.toJSON()),
      ).to.eql(
        sanitizeTimestamps(sampleProject.toJSON()),
      );
    }
  });

  it('gets a project by id', async () => {
    const sampleProject = sampleData.projects[0];
    const project = await Project.findById(sampleProject.getId());

    expect(project).to.be.an('object');
    expect(
      sanitizeTimestamps(project.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleProject.toJSON()),
    );
  });

  it('gets projects by organization id', async () => {
    const organizationId = sampleData.organizations[0].getId();
    const projects = await Project.allByOrganizationId(organizationId);

    expect(projects).to.be.an('array');
    expect(projects.length).to.be.greaterThan(0);

    for (let i = 0; i < projects.length; i += 1) {
      const project = projects[i];
      expect(project.getOrganizationId()).to.equal(organizationId);
    }
  });

  it('adds a new project', async () => {
    const data = {
      projectName: 'New Integration Project',
      organizationId: sampleData.organizations[0].getId(),
    };

    const project = await Project.create(data);

    expect(project).to.be.an('object');
    expect(project.getProjectName()).to.equal(data.projectName);
    expect(project.getOrganizationId()).to.equal(data.organizationId);

    expect(
      sanitizeIdAndAuditFields('Project', project.toJSON()),
    ).to.eql(data);
  });

  it('updates a project', async () => {
    const project = await Project.findById(sampleData.projects[0].getId());

    const data = {
      projectName: 'Updated Project Name',
    };

    project.setProjectName(data.projectName);

    await project.save();

    const updatedProject = await Project.findById(project.getId());

    expect(updatedProject.getProjectName()).to.equal(data.projectName);
    expect(updatedProject.getId()).to.equal(project.getId());
    expect(updatedProject.record.createdAt).to.equal(project.record.createdAt);
    expect(updatedProject.record.updatedAt).to.not.equal(project.record.updatedAt);
  });

  it('removes a project', async () => {
    const project = await Project.findById(sampleData.projects[0].getId());

    await project.remove();

    const notFound = await Project.findById(sampleData.projects[0].getId());
    expect(notFound).to.be.null;
  });

  describe('Project-Site relationship', () => {
    it('gets sites by project id', async () => {
      const projectId = sampleData.projects[0].getId();
      const sites = await Site.allByProjectId(projectId);

      expect(sites).to.be.an('array');

      for (let i = 0; i < sites.length; i += 1) {
        const site = sites[i];
        expect(site.getProjectId()).to.equal(projectId);
      }
    });

    it('gets sites by project name', async () => {
      const projectName = sampleData.projects[0].getProjectName();
      const sites = await Site.getSitesByProjectName(projectName);

      expect(sites).to.be.an('array');

      for (let i = 0; i < sites.length; i += 1) {
        const site = sites[i];
        expect(site.getProjectId()).to.equal(sampleData.projects[0].getId());
      }
    });

    it('gets sites by organization id and project id', async () => {
      const organizationId = sampleData.organizations[0].getId();
      const projectId = sampleData.projects[0].getId();
      const sites = await Site.getSitesByOrganizationIdAndProjectId(organizationId, projectId);

      expect(sites).to.be.an('array');

      for (let i = 0; i < sites.length; i += 1) {
        const site = sites[i];
        expect(site.getProjectId()).to.equal(projectId);
        expect(site.getOrganizationId()).to.equal(organizationId);
      }
    });

    it('gets sites by organization id and project name', async () => {
      const organizationId = sampleData.organizations[0].getId();
      const projectName = sampleData.projects[0].getProjectName();
      const sites = await Site.getSitesByOrganizationIdAndProjectName(organizationId, projectName);

      expect(sites).to.be.an('array');

      for (let i = 0; i < sites.length; i += 1) {
        const site = sites[i];
        expect(site.getProjectId()).to.equal(sampleData.projects[0].getId());
        expect(site.getOrganizationId()).to.equal(organizationId);
      }
    });
  });

  describe('Site localization fields', () => {
    it('creates a site with localization data', async () => {
      const siteData = {
        baseURL: 'https://localized-example.com',
        name: 'localized-site',
        organizationId: sampleData.organizations[0].getId(),
        projectId: sampleData.projects[0].getId(),
        primaryLocale: 'en-US',
        language: 'en',
        region: 'US',
        isLive: true,
        isLiveToggledAt: '2024-12-06T08:35:24.125Z',
      };

      const site = await Site.create(siteData);

      expect(site.getPrimaryLocale()).to.equal('en-US');
      expect(site.getLanguage()).to.equal('en');
      expect(site.getRegion()).to.equal('US');
      expect(site.getProjectId()).to.equal(sampleData.projects[0].getId());

      // Clean up
      await site.remove();
    });

    it('updates site localization data', async () => {
      const site = await Site.findById(sampleData.sites[0].getId());

      site.setPrimaryLocale('fr-FR');
      site.setLanguage('fr');
      site.setRegion('FR');
      site.setProjectId(sampleData.projects[0].getId());

      await site.save();

      const updatedSite = await Site.findById(site.getId());

      expect(updatedSite.getPrimaryLocale()).to.equal('fr-FR');
      expect(updatedSite.getLanguage()).to.equal('fr');
      expect(updatedSite.getRegion()).to.equal('FR');
      expect(updatedSite.getProjectId()).to.equal(sampleData.projects[0].getId());
    });
  });
});
