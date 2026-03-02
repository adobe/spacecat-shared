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

describe('KeyEvent IT', async () => {
  let KeyEvent;

  before(async function () {
    this.timeout(10000);
    await seedDatabase();

    const dataAccess = getDataAccess();
    KeyEvent = dataAccess.KeyEvent;
  });

  it('throws deprecated error when querying key events', async () => {
    await expect(KeyEvent.allBySiteId('dummy-site-id'))
      .to.be.rejectedWith('KeyEvent is deprecated in data-access v3');
  });

  it('throws deprecated error when creating key events', async () => {
    await expect(KeyEvent.create({
      siteId: 'dummy-site-id',
      name: 'deprecated-key-event',
      type: 'PERFORMANCE',
      time: '2024-12-06T08:35:24.125Z',
    })).to.be.rejectedWith('KeyEvent is deprecated in data-access v3');
  });
});
