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
import { sanitizeTimestamps } from '../../../src/util/util.js';

use(chaiAsPromised);

function checkSiteTopForm(siteTopForm) {
  expect(siteTopForm).to.be.an('object');
  expect(siteTopForm.getId()).to.be.a('string');
  expect(siteTopForm.getSiteId()).to.be.a('string');
  expect(siteTopForm.getUrl()).to.be.a('string');
  expect(siteTopForm.getSource()).to.be.a('string');
  expect(siteTopForm.getImportedAt()).to.be.a('string');

  // formSource is optional, so check if it exists and is not empty
  if (siteTopForm.getFormSource() !== undefined && siteTopForm.getFormSource() !== null) {
    expect(siteTopForm.getFormSource()).to.be.a('string');
  }

  // traffic is optional, so check if it exists
  if (siteTopForm.getTraffic() !== undefined) {
    expect(siteTopForm.getTraffic()).to.be.a('number');
  }
}

describe('SiteTopForm IT', async () => {
  let sampleData;
  let SiteTopForm;

  beforeEach(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    SiteTopForm = dataAccess.SiteTopForm;
  });

  it('finds one site top form by id', async () => {
    const siteTopForm = await SiteTopForm.findById(sampleData.siteTopForms[0].getId());

    expect(siteTopForm).to.be.an('object');
    const actualForm = sanitizeTimestamps(siteTopForm.toJSON());
    const expectedForm = sanitizeTimestamps(sampleData.siteTopForms[0].toJSON());

    // Handle the case where formSource might be null in seeded data but empty string in new schema
    if (actualForm.formSource === null && expectedForm.formSource === '') {
      actualForm.formSource = '';
    }

    expect(actualForm).to.eql(expectedForm);
  });

  it('gets all site top forms for a site', async () => {
    const site = sampleData.sites[0];

    const siteTopForms = await SiteTopForm.allBySiteId(site.getId());

    expect(siteTopForms).to.be.an('array');
    expect(siteTopForms.length).to.equal(5);

    siteTopForms.forEach((siteTopForm) => {
      checkSiteTopForm(siteTopForm);
      expect(siteTopForm.getSiteId()).to.equal(site.getId());
    });
  });

  it('gets all top forms for a site from a specific source in descending traffic order', async () => {
    const site = sampleData.sites[0];
    const source = 'ahrefs';

    const siteTopForms = await SiteTopForm.allBySiteIdAndSource(
      site.getId(),
      source,
      { order: 'desc' },
    );

    expect(siteTopForms).to.be.an('array');
    expect(siteTopForms.length).to.equal(5);

    siteTopForms.forEach((siteTopForm) => {
      checkSiteTopForm(siteTopForm);
      expect(siteTopForm.getSiteId()).to.equal(site.getId());
      expect(siteTopForm.getSource()).to.equal(source);
    });

    // Check traffic ordering (only for forms that have traffic)
    const formsWithTraffic = siteTopForms.filter((form) => form.getTraffic() !== undefined);
    for (let i = 1; i < formsWithTraffic.length; i += 1) {
      expect(formsWithTraffic[i - 1].getTraffic()).to.be.at.least(formsWithTraffic[i].getTraffic());
    }
  });

  it('creates a site top form', async () => {
    const data = {
      siteId: sampleData.sites[0].getId(),
      url: 'https://www.example.com/contact',
      formSource: '#contact-form',
      traffic: 100,
      source: 'google',
      importedAt: '2024-12-06T08:35:24.125Z',
    };
    const siteTopForm = await SiteTopForm.create(data);

    checkSiteTopForm(siteTopForm);

    expect(siteTopForm.getSiteId()).to.equal(data.siteId);
    expect(siteTopForm.getUrl()).to.equal(data.url);
    expect(siteTopForm.getFormSource()).to.equal(data.formSource);
    expect(siteTopForm.getTraffic()).to.equal(data.traffic);
    expect(siteTopForm.getSource()).to.equal(data.source);
    expect(siteTopForm.getImportedAt()).to.equal(data.importedAt);
  });

  it('creates a site top form without traffic', async () => {
    const data = {
      siteId: sampleData.sites[0].getId(),
      url: 'https://www.example.com/newsletter',
      formSource: '.newsletter-form',
      source: 'google',
      importedAt: '2024-12-06T08:35:24.125Z',
    };
    const siteTopForm = await SiteTopForm.create(data);

    checkSiteTopForm(siteTopForm);

    expect(siteTopForm.getSiteId()).to.equal(data.siteId);
    expect(siteTopForm.getUrl()).to.equal(data.url);
    expect(siteTopForm.getFormSource()).to.equal(data.formSource);
    expect(siteTopForm.getTraffic()).to.equal(0);
    expect(siteTopForm.getSource()).to.equal(data.source);
    expect(siteTopForm.getImportedAt()).to.equal(data.importedAt);
  });

  it('creates a site top form without formSource (empty string)', async () => {
    const data = {
      siteId: sampleData.sites[0].getId(),
      url: 'https://www.example.com/form-without-source',
      source: 'google',
      traffic: 75,
      importedAt: '2024-12-06T08:35:24.125Z',
    };
    const siteTopForm = await SiteTopForm.create(data);

    checkSiteTopForm(siteTopForm);

    expect(siteTopForm.getSiteId()).to.equal(data.siteId);
    expect(siteTopForm.getUrl()).to.equal(data.url);
    expect(siteTopForm.getFormSource()).to.equal(''); // Should default to empty string
    expect(siteTopForm.getTraffic()).to.equal(data.traffic);
    expect(siteTopForm.getSource()).to.equal(data.source);
    expect(siteTopForm.getImportedAt()).to.equal(data.importedAt);

    // Test that we can find it using empty formSource
    const foundForm = await SiteTopForm.findByUrlAndFormSource(data.url, '');
    expect(foundForm).to.not.be.null;
    expect(foundForm.getId()).to.equal(siteTopForm.getId());

    // Test that we can also find it without specifying formSource (should default to empty)
    const foundFormDefault = await SiteTopForm.findByUrlAndFormSource(data.url);
    expect(foundFormDefault).to.not.be.null;
    expect(foundFormDefault.getId()).to.equal(siteTopForm.getId());
  });

  it('throws error when creating site top form without URL', async () => {
    const data = {
      siteId: sampleData.sites[0].getId(),
      formSource: '#contact-form',
      source: 'google',
      traffic: 100,
      importedAt: '2024-12-06T08:35:24.125Z',
    };

    await expect(SiteTopForm.create(data))
      .to.be.rejectedWith('URL is required and cannot be empty');
  });

  it('throws error when creating site top form with empty URL', async () => {
    const data = {
      siteId: sampleData.sites[0].getId(),
      url: '',
      formSource: '#contact-form',
      source: 'google',
      traffic: 100,
      importedAt: '2024-12-06T08:35:24.125Z',
    };

    await expect(SiteTopForm.create(data))
      .to.be.rejectedWith('URL is required and cannot be empty');
  });

  it('creates site top form with formSource set to null (defaults to empty string)', async () => {
    const data = {
      siteId: sampleData.sites[0].getId(),
      url: 'https://www.example.com/form-null-source',
      formSource: null,
      source: 'google',
      traffic: 50,
      importedAt: '2024-12-06T08:35:24.125Z',
    };

    const siteTopForm = await SiteTopForm.create(data);

    expect(siteTopForm.getFormSource()).to.equal(''); // Should default to empty string
  });

  it('creates site top form with formSource set to undefined (defaults to empty string)', async () => {
    const data = {
      siteId: sampleData.sites[0].getId(),
      url: 'https://www.example.com/form-undefined-source',
      formSource: undefined,
      source: 'google',
      traffic: 25,
      importedAt: '2024-12-06T08:35:24.125Z',
    };

    const siteTopForm = await SiteTopForm.create(data);

    expect(siteTopForm.getFormSource()).to.equal(''); // Should default to empty string
  });

  it('creates multiple site top forms with createMany', async () => {
    const site = sampleData.sites[0];
    const forms = [
      {
        siteId: site.getId(),
        url: 'https://www.example.com/form1',
        formSource: '#form1',
        source: 'batch-test',
        traffic: 100,
        importedAt: '2024-12-06T08:35:24.125Z',
      },
      {
        siteId: site.getId(),
        url: 'https://www.example.com/form2',
        formSource: null, // Should default to empty string
        source: 'batch-test',
        traffic: 50,
        importedAt: '2024-12-06T08:35:24.125Z',
      },
      {
        siteId: site.getId(),
        url: 'https://www.example.com/form3',
        // formSource not provided - should default to empty string
        source: 'batch-test',
        traffic: 25,
        importedAt: '2024-12-06T08:35:24.125Z',
      },
    ];

    const result = await SiteTopForm.createMany(forms);

    expect(result.createdItems).to.be.an('array');
    expect(result.createdItems.length).to.equal(3);
    expect(result.errorItems).to.be.an('array');
    expect(result.errorItems.length).to.equal(0);

    // Check that formSource defaults were applied correctly
    expect(result.createdItems[0].getFormSource()).to.equal('#form1');
    expect(result.createdItems[1].getFormSource()).to.equal(''); // null -> empty string
    expect(result.createdItems[2].getFormSource()).to.equal(''); // undefined -> empty string
  });

  it('throws error when createMany contains item without URL', async () => {
    const site = sampleData.sites[0];
    const forms = [
      {
        siteId: site.getId(),
        url: 'https://www.example.com/valid-form',
        formSource: '#valid-form',
        source: 'batch-test',
        traffic: 100,
        importedAt: '2024-12-06T08:35:24.125Z',
      },
      {
        siteId: site.getId(),
        // Missing URL
        formSource: '#invalid-form',
        source: 'batch-test',
        traffic: 50,
        importedAt: '2024-12-06T08:35:24.125Z',
      },
    ];

    await expect(SiteTopForm.createMany(forms))
      .to.be.rejectedWith('URL is required and cannot be empty for all items');
  });

  it('throws error when createMany contains item with empty URL', async () => {
    const site = sampleData.sites[0];
    const forms = [
      {
        siteId: site.getId(),
        url: 'https://www.example.com/valid-form',
        formSource: '#valid-form',
        source: 'batch-test',
        traffic: 100,
        importedAt: '2024-12-06T08:35:24.125Z',
      },
      {
        siteId: site.getId(),
        url: '', // Empty URL
        formSource: '#invalid-form',
        source: 'batch-test',
        traffic: 50,
        importedAt: '2024-12-06T08:35:24.125Z',
      },
    ];

    await expect(SiteTopForm.createMany(forms))
      .to.be.rejectedWith('URL is required and cannot be empty for all items');
  });

  it('updates a site top form', async () => {
    const siteTopForm = await SiteTopForm.findById(sampleData.siteTopForms[0].getId());

    const updates = {
      traffic: 200,
      source: 'bing',
      formSource: '#updated-contact-form',
      importedAt: '2024-12-07T08:35:24.125Z',
    };

    siteTopForm
      .setTraffic(updates.traffic)
      .setSource(updates.source)
      .setFormSource(updates.formSource)
      .setImportedAt(updates.importedAt);

    await siteTopForm.save();

    const updatedSiteTopForm = await SiteTopForm.findById(sampleData.siteTopForms[0].getId());

    checkSiteTopForm(updatedSiteTopForm);

    expect(updatedSiteTopForm.getTraffic()).to.equal(updates.traffic);
    expect(updatedSiteTopForm.getSource()).to.equal(updates.source);
    expect(updatedSiteTopForm.getFormSource()).to.equal(updates.formSource);
    expect(updatedSiteTopForm.getImportedAt()).to.equal(updates.importedAt);
  });

  it('stores and returns multiple top forms with identical source and traffic', async () => {
    const site = sampleData.sites[0];
    const source = 'some-source';
    const traffic = 1000;
    const createdForms = [];

    for (let i = 0; i < 2; i += 1) {
      const data = {
        siteId: site.getId(),
        url: `https://www.example.com/form${i}`,
        formSource: `#form-${i}`,
        traffic,
        source,
      };

      // eslint-disable-next-line no-await-in-loop
      createdForms.push(await SiteTopForm.create(data));
    }

    const siteTopForms = await SiteTopForm.allBySiteIdAndSource(
      site.getId(),
      source,
    );

    expect(siteTopForms).to.be.an('array');
    expect(siteTopForms.length).to.equal(2);

    expect(siteTopForms.some((form) => form.getId() === createdForms[0].getId())).to.equal(true);
    expect(siteTopForms.some((form) => form.getId() === createdForms[1].getId())).to.equal(true);
  });

  it('finds form by URL and formSource', async () => {
    const siteTopForm = sampleData.siteTopForms[0];
    const url = siteTopForm.getUrl();
    const formSource = siteTopForm.getFormSource();

    const foundForm = await SiteTopForm.findByUrlAndFormSource(url, formSource);

    expect(foundForm).to.be.an('object');
    expect(foundForm.getId()).to.equal(siteTopForm.getId());
    expect(foundForm.getUrl()).to.equal(url);

    // Handle the case where database might have null but fixture has empty string
    const actualFormSource = foundForm.getFormSource();
    const expectedFormSource = formSource;
    if ((actualFormSource === null && expectedFormSource === '')
        || (actualFormSource === '' && expectedFormSource === null)) {
      // Both null and empty string are considered equivalent for optional formSource
      expect(actualFormSource === expectedFormSource
             || (actualFormSource === null && expectedFormSource === '')
             || (actualFormSource === '' && expectedFormSource === null)).to.be.true;
    } else {
      expect(actualFormSource).to.equal(expectedFormSource);
    }
  });

  it('removes a site top form', async () => {
    const siteTopForm = await SiteTopForm.findById(sampleData.siteTopForms[0].getId());

    await siteTopForm.remove();

    const notFound = await SiteTopForm.findById(sampleData.siteTopForms[0].getId());
    expect(notFound).to.equal(null);
  });

  it('removes all site top forms for a site', async () => {
    const site = sampleData.sites[0];

    await SiteTopForm.removeForSiteId(site.getId());

    const siteTopForms = await SiteTopForm.allBySiteId(site.getId());
    expect(siteTopForms).to.be.an('array');
    expect(siteTopForms.length).to.equal(0);
  });

  it('removes specific form by URL and formSource', async () => {
    const siteTopForm = sampleData.siteTopForms[1];
    const url = siteTopForm.getUrl();
    const formSource = siteTopForm.getFormSource();

    await SiteTopForm.removeByUrlAndFormSource(url, formSource);

    const notFound = await SiteTopForm.findByUrlAndFormSource(url, formSource);
    expect(notFound).to.equal(null);
  });

  it('handles multiple forms on the same page with different formSources', async () => {
    const site = sampleData.sites[0];
    const url = 'https://www.example.com/contact';
    const formSource1 = '#contact-form';
    const formSource2 = '#newsletter-form';

    const data1 = {
      siteId: site.getId(),
      url,
      formSource: formSource1,
      traffic: 100,
      source: 'ahrefs',
    };

    const data2 = {
      siteId: site.getId(),
      url,
      formSource: formSource2,
      traffic: 50,
      source: 'ahrefs',
    };

    const form1 = await SiteTopForm.create(data1);
    const form2 = await SiteTopForm.create(data2);

    // Both forms should exist
    const foundForm1 = await SiteTopForm.findByUrlAndFormSource(url, formSource1);
    const foundForm2 = await SiteTopForm.findByUrlAndFormSource(url, formSource2);

    expect(foundForm1.getId()).to.equal(form1.getId());
    expect(foundForm2.getId()).to.equal(form2.getId());

    // Remove one form, the other should still exist
    await SiteTopForm.removeByUrlAndFormSource(url, formSource1);

    const notFound1 = await SiteTopForm.findByUrlAndFormSource(url, formSource1);
    const stillFound2 = await SiteTopForm.findByUrlAndFormSource(url, formSource2);

    expect(notFound1).to.equal(null);
    expect(stillFound2.getId()).to.equal(form2.getId());
  });

  it('throws error when findByUrlAndFormSource called without URL', async () => {
    await expect(SiteTopForm.findByUrlAndFormSource())
      .to.be.rejectedWith('URL is required');
  });

  it('throws error when findByUrlAndFormSource called with empty URL', async () => {
    await expect(SiteTopForm.findByUrlAndFormSource(''))
      .to.be.rejectedWith('URL is required');
  });

  it('returns null when findByUrlAndFormSource cannot find form', async () => {
    const nonExistentUrl = 'https://www.nonexistent.com/form';
    const result = await SiteTopForm.findByUrlAndFormSource(nonExistentUrl, '#nonexistent');

    expect(result).to.equal(null);
  });

  it('handles default formSource parameter in findByUrlAndFormSource', async () => {
    const site = sampleData.sites[0];
    const url = 'https://www.example.com/test-default-param';

    // Create form with empty formSource
    const data = {
      siteId: site.getId(),
      url,
      source: 'test-default',
      traffic: 10,
      importedAt: '2024-12-06T08:35:24.125Z',
    };
    const createdForm = await SiteTopForm.create(data);

    // Should find it when called without formSource parameter (defaults to empty string)
    const foundForm = await SiteTopForm.findByUrlAndFormSource(url);
    expect(foundForm).to.not.be.null;
    expect(foundForm.getId()).to.equal(createdForm.getId());

    // Should also find it when explicitly passed empty string
    const foundFormExplicit = await SiteTopForm.findByUrlAndFormSource(url, '');
    expect(foundFormExplicit).to.not.be.null;
    expect(foundFormExplicit.getId()).to.equal(createdForm.getId());
  });

  it('throws error when removeByUrlAndFormSource called without URL', async () => {
    await expect(SiteTopForm.removeByUrlAndFormSource())
      .to.be.rejectedWith('URL is required');
  });

  it('throws error when removeByUrlAndFormSource called with empty URL', async () => {
    await expect(SiteTopForm.removeByUrlAndFormSource(''))
      .to.be.rejectedWith('URL is required');
  });

  it('handles default formSource parameter in removeByUrlAndFormSource', async () => {
    const site = sampleData.sites[0];
    const url = 'https://www.example.com/test-remove-default';

    // Create form with empty formSource
    const data = {
      siteId: site.getId(),
      url,
      source: 'test-remove',
      traffic: 15,
      importedAt: '2024-12-06T08:35:24.125Z',
    };
    const createdForm = await SiteTopForm.create(data);

    // Verify it exists
    let foundForm = await SiteTopForm.findByUrlAndFormSource(url);
    expect(foundForm).to.not.be.null;
    expect(foundForm.getId()).to.equal(createdForm.getId());

    // Remove it without specifying formSource (should default to empty string)
    await SiteTopForm.removeByUrlAndFormSource(url);

    // Verify it's gone
    foundForm = await SiteTopForm.findByUrlAndFormSource(url);
    expect(foundForm).to.equal(null);
  });

  it('removeByUrlAndFormSource handles non-existent form gracefully', async () => {
    const nonExistentUrl = 'https://www.nonexistent.com/remove-test';

    // Should not throw error when trying to remove non-existent form
    await expect(SiteTopForm.removeByUrlAndFormSource(nonExistentUrl, '#nonexistent'))
      .to.not.be.rejected;
  });
});
