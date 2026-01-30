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

/* eslint-env mocha */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

function checkSentimentGuideline(guideline) {
  expect(guideline).to.be.an('object');
  expect(guideline.getSiteId()).to.be.a('string');
  expect(guideline.getGuidelineId()).to.be.a('string');
  expect(guideline.getName()).to.be.a('string');
  expect(guideline.getInstruction()).to.be.a('string');
  expect(guideline.getAudits()).to.be.an('array');
  expect(guideline.getEnabled()).to.be.a('boolean');
  expect(guideline.getCreatedAt()).to.be.a('string');
  expect(guideline.getCreatedBy()).to.be.a('string');
}

// eslint-disable-next-line prefer-arrow-callback
describe('SentimentGuideline IT', function () {
  let sampleData;
  let SentimentGuideline;

  // eslint-disable-next-line prefer-arrow-callback
  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    SentimentGuideline = dataAccess.SentimentGuideline;
  });

  it('gets all sentiment guidelines for a site', async () => {
    const site = sampleData.sites[0];

    const result = await SentimentGuideline.allBySiteId(site.getId());

    expect(result).to.be.an('object');
    expect(result.data).to.be.an('array');
    expect(result.data.length).to.equal(3);

    result.data.forEach((guideline) => {
      checkSentimentGuideline(guideline);
      expect(guideline.getSiteId()).to.equal(site.getId());
    });
  });

  it('finds a sentiment guideline by site ID and guideline ID', async () => {
    const site = sampleData.sites[0];
    const guidelineId = sampleData.sentimentGuidelines[0].getGuidelineId();

    const guideline = await SentimentGuideline.findById(site.getId(), guidelineId);

    expect(guideline).to.be.an('object');
    checkSentimentGuideline(guideline);
    expect(guideline.getSiteId()).to.equal(site.getId());
    expect(guideline.getGuidelineId()).to.equal(guidelineId);
  });

  it('returns null when sentiment guideline not found', async () => {
    const site = sampleData.sites[0];
    const nonExistentId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';

    const guideline = await SentimentGuideline.findById(site.getId(), nonExistentId);

    expect(guideline).to.be.null;
  });

  it('creates a new sentiment guideline', async () => {
    const site = sampleData.sites[0];
    const data = {
      siteId: site.getId(),
      name: 'New Guideline',
      instruction: 'A new test guideline instruction',
      audits: ['wikipedia-analysis'],
      enabled: true,
      createdBy: 'test@example.com',
    };

    const guideline = await SentimentGuideline.create(data);

    checkSentimentGuideline(guideline);
    expect(guideline.getSiteId()).to.equal(data.siteId);
    expect(guideline.getName()).to.equal(data.name);
    expect(guideline.getInstruction()).to.equal(data.instruction);
    expect(guideline.getAudits()).to.deep.equal(data.audits);
    expect(guideline.getEnabled()).to.equal(data.enabled);
    expect(guideline.getCreatedBy()).to.equal(data.createdBy);
  });

  it('creates a sentiment guideline with default values', async () => {
    const site = sampleData.sites[0];
    const data = {
      siteId: site.getId(),
      name: 'Minimal Guideline',
      instruction: 'Minimal instruction',
      createdBy: 'test@example.com',
    };

    const guideline = await SentimentGuideline.create(data);

    checkSentimentGuideline(guideline);
    expect(guideline.getEnabled()).to.equal(true); // Default
    expect(guideline.getAudits()).to.deep.equal([]); // Default
  });

  it('updates a sentiment guideline', async () => {
    const site = sampleData.sites[0];
    const guidelineId = sampleData.sentimentGuidelines[0].getGuidelineId();
    const guideline = await SentimentGuideline.findById(site.getId(), guidelineId);

    guideline.setName('Updated Name');
    guideline.setInstruction('Updated instruction');
    guideline.setUpdatedBy('updater@example.com');

    const updated = await guideline.save();

    expect(updated.getName()).to.equal('Updated Name');
    expect(updated.getInstruction()).to.equal('Updated instruction');
    expect(updated.getUpdatedBy()).to.equal('updater@example.com');
  });

  it('removes a sentiment guideline', async () => {
    const site = sampleData.sites[0];
    const data = {
      siteId: site.getId(),
      name: 'Guideline to Delete',
      instruction: 'Will be deleted',
      createdBy: 'test@example.com',
    };

    const guideline = await SentimentGuideline.create(data);
    const siteId = guideline.getSiteId();
    const guidelineId = guideline.getGuidelineId();

    await guideline.remove();

    const deleted = await SentimentGuideline.findById(siteId, guidelineId);
    expect(deleted).to.be.null;
  });

  describe('Custom Methods', () => {
    it('adds an audit', async () => {
      const site = sampleData.sites[0];
      const guidelineId = sampleData.sentimentGuidelines[0].getGuidelineId();
      const guideline = await SentimentGuideline.findById(site.getId(), guidelineId);
      const originalLength = guideline.getAudits().length;

      guideline.addAudit('new-audit-type');

      expect(guideline.getAudits()).to.include('new-audit-type');
      expect(guideline.getAudits().length).to.equal(originalLength + 1);
    });

    it('removes an audit', async () => {
      const site = sampleData.sites[0];
      const guidelineId = sampleData.sentimentGuidelines[0].getGuidelineId();
      const guideline = await SentimentGuideline.findById(site.getId(), guidelineId);

      // Ensure there's an audit to remove
      const auditToRemove = guideline.getAudits()[0];
      if (auditToRemove) {
        guideline.removeAudit(auditToRemove);
        expect(guideline.getAudits()).to.not.include(auditToRemove);
      }
    });

    it('checks if audit is linked', async () => {
      const site = sampleData.sites[0];
      const guidelineId = sampleData.sentimentGuidelines[0].getGuidelineId();
      const guideline = await SentimentGuideline.findById(site.getId(), guidelineId);

      const linkedAudit = guideline.getAudits()[0];
      if (linkedAudit) {
        expect(guideline.isAuditLinked(linkedAudit)).to.be.true;
      }
      expect(guideline.isAuditLinked('nonexistent-audit')).to.be.false;
    });

    it('toggles enabled state', async () => {
      const site = sampleData.sites[0];
      const guidelineId = sampleData.sentimentGuidelines[0].getGuidelineId();
      const guideline = await SentimentGuideline.findById(site.getId(), guidelineId);
      const originalState = guideline.getEnabled();

      guideline.setEnabled(!originalState);

      expect(guideline.getEnabled()).to.equal(!originalState);
    });
  });

  describe('Collection Methods', () => {
    it('gets enabled guidelines for a site', async () => {
      const site = sampleData.sites[0];

      const result = await SentimentGuideline.allBySiteIdEnabled(site.getId());

      expect(result).to.be.an('object');
      expect(result.data).to.be.an('array');

      result.data.forEach((guideline) => {
        expect(guideline.getEnabled()).to.be.true;
      });
    });

    it('gets guidelines by audit type', async () => {
      const site = sampleData.sites[0];

      const result = await SentimentGuideline.allBySiteIdAndAuditType(
        site.getId(),
        'wikipedia-analysis',
      );

      expect(result).to.be.an('object');
      expect(result.data).to.be.an('array');

      result.data.forEach((guideline) => {
        expect(guideline.isAuditLinked('wikipedia-analysis')).to.be.true;
      });
    });

    it('finds guidelines by multiple IDs', async () => {
      const site = sampleData.sites[0];
      const ids = [
        sampleData.sentimentGuidelines[0].getGuidelineId(),
        sampleData.sentimentGuidelines[1].getGuidelineId(),
      ];

      const guidelines = await SentimentGuideline.findByIds(site.getId(), ids);

      expect(guidelines).to.be.an('array');
      expect(guidelines.length).to.equal(2);
    });

    it('removes all guidelines for a site', async () => {
      const site = sampleData.sites[1];

      // Verify guidelines exist
      let result = await SentimentGuideline.allBySiteId(site.getId());
      expect(result.data.length).to.be.greaterThan(0);

      // Remove all
      await SentimentGuideline.removeForSiteId(site.getId());

      // Verify removed
      result = await SentimentGuideline.allBySiteId(site.getId());
      expect(result.data.length).to.equal(0);
    });
  });

  describe('Validation', () => {
    it('rejects invalid UUID for siteId', async () => {
      const data = {
        siteId: 'invalid-uuid',
        name: 'Test Guideline',
        instruction: 'Test instruction',
        createdBy: 'test@example.com',
      };

      await expect(SentimentGuideline.create(data)).to.be.rejected;
    });

    it('requires siteId', async () => {
      const data = {
        name: 'Test Guideline',
        instruction: 'Test instruction',
        createdBy: 'test@example.com',
      };

      await expect(SentimentGuideline.create(data)).to.be.rejected;
    });

    it('requires name', async () => {
      const site = sampleData.sites[0];
      const data = {
        siteId: site.getId(),
        instruction: 'Test instruction',
        createdBy: 'test@example.com',
      };

      await expect(SentimentGuideline.create(data)).to.be.rejected;
    });

    it('requires instruction', async () => {
      const site = sampleData.sites[0];
      const data = {
        siteId: site.getId(),
        name: 'Test Guideline',
        createdBy: 'test@example.com',
      };

      await expect(SentimentGuideline.create(data)).to.be.rejected;
    });
  });
});
