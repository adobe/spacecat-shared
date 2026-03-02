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

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

function checkAuditUrl(auditUrl) {
  expect(auditUrl).to.be.an('object');
  // Composite primary key: siteId + url
  expect(auditUrl.getSiteId()).to.be.a('string');
  expect(auditUrl.getUrl()).to.be.a('string');
  expect(auditUrl.getByCustomer()).to.be.a('boolean');
  expect(auditUrl.getAudits()).to.be.an('array');
  expect(auditUrl.getCreatedAt()).to.be.a('string');
  expect(auditUrl.getCreatedBy()).to.be.a('string');
}

// eslint-disable-next-line prefer-arrow-callback
describe('AuditUrl IT', function () {
  let sampleData;
  let AuditUrl;

  // eslint-disable-next-line prefer-arrow-callback
  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    AuditUrl = dataAccess.AuditUrl;
  });

  it('gets all audit URLs for a site', async () => {
    const site = sampleData.sites[0];

    const auditUrls = await AuditUrl.allBySiteId(site.getId());

    expect(auditUrls).to.be.an('array');
    expect(auditUrls.length).to.equal(3);

    auditUrls.forEach((auditUrl) => {
      checkAuditUrl(auditUrl);
      expect(auditUrl.getSiteId()).to.equal(site.getId());
    });
  });

  it('gets all audit URLs for a site by byCustomer flag', async () => {
    const site = sampleData.sites[0];
    const byCustomer = true;

    // Use allBySiteIdByCustomerSorted since direct GSI accessor fails for boolean false
    const result = await AuditUrl.allBySiteIdByCustomerSorted(site.getId(), byCustomer, {});

    // Returns { data, cursor } format for pagination
    expect(result).to.be.an('object');
    expect(result.data).to.be.an('array');
    expect(result.data.length).to.equal(2);

    result.data.forEach((auditUrl) => {
      checkAuditUrl(auditUrl);
      expect(auditUrl.getSiteId()).to.equal(site.getId());
      expect(auditUrl.getByCustomer()).to.equal(byCustomer);
    });
  });

  it('finds an audit URL by site ID and URL (GSI lookup)', async () => {
    const site = sampleData.sites[0];
    const url = 'https://example0.com/page-1';

    const auditUrl = await AuditUrl.findBySiteIdAndUrl(site.getId(), url);

    expect(auditUrl).to.be.an('object');
    checkAuditUrl(auditUrl);
    expect(auditUrl.getSiteId()).to.equal(site.getId());
    expect(auditUrl.getUrl()).to.equal(url);
  });

  it('returns null when audit URL not found', async () => {
    const site = sampleData.sites[0];
    const url = 'https://example0.com/nonexistent';

    const auditUrl = await AuditUrl.findBySiteIdAndUrl(site.getId(), url);

    expect(auditUrl).to.be.null;
  });

  it('creates a new audit URL', async () => {
    const site = sampleData.sites[0];
    const data = {
      siteId: site.getId(),
      url: 'https://example0.com/new-page',
      byCustomer: true,
      audits: ['accessibility', 'broken-backlinks'],
      createdBy: 'test@example.com',
    };

    const auditUrl = await AuditUrl.create(data);

    checkAuditUrl(auditUrl);
    expect(auditUrl.getSiteId()).to.equal(data.siteId);
    expect(auditUrl.getUrl()).to.equal(data.url);
    expect(auditUrl.getByCustomer()).to.equal(data.byCustomer);
    expect(auditUrl.getAudits()).to.deep.equal(data.audits);
    expect(auditUrl.getCreatedBy()).to.equal(data.createdBy);
  });

  it('creates an audit URL with default values', async () => {
    const site = sampleData.sites[0];
    const data = {
      siteId: site.getId(),
      url: 'https://example0.com/default-page',
      createdBy: 'test@example.com',
    };

    const auditUrl = await AuditUrl.create(data);

    checkAuditUrl(auditUrl);
    expect(auditUrl.getByCustomer()).to.equal(true); // Default
    expect(auditUrl.getAudits()).to.deep.equal([]); // Default
  });

  it('finds an audit URL by composite primary key (siteId + url)', async () => {
    const site = sampleData.sites[0];
    const data = {
      siteId: site.getId(),
      url: 'https://example0.com/findbyid-page',
      byCustomer: true,
      audits: ['accessibility'],
      createdBy: 'test@example.com',
    };

    const created = await AuditUrl.create(data);
    const siteId = created.getSiteId();
    const url = created.getUrl();

    // findById uses composite key (siteId + url)
    const found = await AuditUrl.findById(siteId, url);

    expect(found).to.not.be.null;
    checkAuditUrl(found);
    expect(found.getSiteId()).to.equal(siteId);
    expect(found.getUrl()).to.equal(url);
  });

  it('updates an audit URL', async () => {
    const site = sampleData.sites[0];
    const url = 'https://example0.com/page-1';
    const auditUrl = await AuditUrl.findBySiteIdAndUrl(site.getId(), url);

    auditUrl.setAudits(['accessibility']);
    auditUrl.setUpdatedBy('updater@example.com');

    const updated = await auditUrl.save();

    expect(updated.getAudits()).to.deep.equal(['accessibility']);
    expect(updated.getUpdatedBy()).to.equal('updater@example.com');
  });

  it('removes an audit URL', async () => {
    const site = sampleData.sites[0];
    const data = {
      siteId: site.getId(),
      url: 'https://example0.com/to-delete',
      byCustomer: true,
      audits: ['accessibility'],
      createdBy: 'test@example.com',
    };

    const auditUrl = await AuditUrl.create(data);
    const siteId = auditUrl.getSiteId();
    const url = auditUrl.getUrl();

    await auditUrl.remove();

    const deleted = await AuditUrl.findBySiteIdAndUrl(siteId, url);
    expect(deleted).to.be.null;
  });

  describe('Custom Methods', () => {
    it('checks if an audit is enabled', async () => {
      const site = sampleData.sites[0];
      const auditUrl = await AuditUrl.findBySiteIdAndUrl(site.getId(), 'https://example0.com/page-1');

      expect(auditUrl.isAuditEnabled('accessibility')).to.be.true;
      expect(auditUrl.isAuditEnabled('lhs-mobile')).to.be.false;
    });

    it('enables an audit', async () => {
      const site = sampleData.sites[0];
      const auditUrl = await AuditUrl.findBySiteIdAndUrl(site.getId(), 'https://example0.com/page-1');
      const originalAudits = auditUrl.getAudits();

      auditUrl.enableAudit('lhs-mobile');

      expect(auditUrl.getAudits()).to.include('lhs-mobile');
      expect(auditUrl.getAudits().length).to.equal(originalAudits.length + 1);
    });

    it('does not duplicate audits when enabling', async () => {
      const site = sampleData.sites[0];
      const auditUrl = await AuditUrl.findBySiteIdAndUrl(site.getId(), 'https://example0.com/page-1');
      const originalLength = auditUrl.getAudits().length;

      auditUrl.enableAudit('accessibility'); // Already enabled

      expect(auditUrl.getAudits().length).to.equal(originalLength);
    });

    it('disables an audit', async () => {
      const site = sampleData.sites[0];
      const auditUrl = await AuditUrl.findBySiteIdAndUrl(site.getId(), 'https://example0.com/page-1');

      auditUrl.disableAudit('accessibility');

      expect(auditUrl.getAudits()).to.not.include('accessibility');
    });

    it('checks if URL is customer-added', async () => {
      const site = sampleData.sites[0];
      const customerUrl = await AuditUrl.findBySiteIdAndUrl(site.getId(), 'https://example0.com/page-1');
      const systemUrl = await AuditUrl.findBySiteIdAndUrl(site.getId(), 'https://example0.com/page-2');

      expect(customerUrl.isCustomerUrl()).to.be.true;
      expect(systemUrl.isCustomerUrl()).to.be.false;
    });
  });

  describe('Collection Methods', () => {
    it('gets all audit URLs by audit type', async () => {
      const site = sampleData.sites[0];

      const result = await AuditUrl.allBySiteIdAndAuditType(
        site.getId(),
        'accessibility',
      );

      // Returns { data, cursor } format for pagination
      expect(result).to.be.an('object');
      expect(result.data).to.be.an('array');
      // Fixture has 2 URLs with 'accessibility', plus tests add more:
      // - "creates a new audit URL" adds 1
      // - "finds an audit URL by composite key" adds 1
      expect(result.data.length).to.equal(4);

      result.data.forEach((auditUrl) => {
        expect(auditUrl.isAuditEnabled('accessibility')).to.be.true;
      });
    });

    it('removes all audit URLs for a site', async () => {
      const site = sampleData.sites[2];

      // Verify URLs exist
      let auditUrls = await AuditUrl.allBySiteId(site.getId());
      expect(auditUrls.length).to.be.greaterThan(0);

      // Remove all
      await AuditUrl.removeForSiteId(site.getId());

      // Verify removed
      auditUrls = await AuditUrl.allBySiteId(site.getId());
      expect(auditUrls.length).to.equal(0);
    });

    it('removes audit URLs by byCustomer flag', async () => {
      const site = sampleData.sites[0];

      // Remove all customer-added URLs
      await AuditUrl.removeForSiteIdByCustomer(site.getId(), true);

      // Verify only system-added URLs remain
      const auditUrls = await AuditUrl.allBySiteId(site.getId());
      auditUrls.forEach((auditUrl) => {
        expect(auditUrl.getByCustomer()).to.equal(false);
      });
    });
  });

  describe('Validation', () => {
    it('rejects invalid UUID for siteId', async () => {
      const data = {
        siteId: 'invalid-uuid',
        url: 'https://example.com/page',
        createdBy: 'test@example.com',
      };

      await expect(AuditUrl.create(data)).to.be.rejected;
    });

    it('rejects invalid URL format', async () => {
      const site = sampleData.sites[0];
      const data = {
        siteId: site.getId(),
        url: 'not-a-valid-url',
        createdBy: 'test@example.com',
      };

      await expect(AuditUrl.create(data)).to.be.rejected;
    });

    it('requires siteId', async () => {
      const data = {
        url: 'https://example.com/page',
        createdBy: 'test@example.com',
      };

      await expect(AuditUrl.create(data)).to.be.rejected;
    });

    it('requires url', async () => {
      const site = sampleData.sites[0];
      const data = {
        siteId: site.getId(),
        createdBy: 'test@example.com',
      };

      await expect(AuditUrl.create(data)).to.be.rejected;
    });
  });
});
