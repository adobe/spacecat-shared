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
import * as electrodb from 'electrodb';

import EntityRegistry from '../../../../src/models/base/entity.registry.js';

/**
 * Regression guard for downstream Service construction.
 *
 * Every entity schema produced by `EntityRegistry.getEntities()` is fed into
 * `new electrodb.Service(...)` by at least one downstream consumer (e.g.
 * `spacecat-api-service/test/controllers/fixes.test.js`). ElectroDB validates
 * the schema shape eagerly at Service construction — invalid attribute
 * declarations such as `type: 'map'` without a `properties` block throw
 * `InvalidAttributeDefinition`, but only when a consumer actually instantiates
 * the Service. The result is that schema regressions pass this package's CI
 * (the PostgREST runtime never invokes ElectroDB) and only surface days later
 * in unrelated downstream PRs after the broken minor has been published.
 *
 * Concrete prior incident: 3.72.0 shipped `Preflight.createdBy` and
 * `Preflight.error` as `type: 'map'` with no `properties`. Every downstream
 * consumer that constructed an ElectroDB Service began throwing on import.
 * Fix landed in 3.73.1 (PR #1636). This test makes the regression visible at
 * spacecat-shared PR time so the broken minor never publishes again.
 *
 * The test does NOT mock or partially register entities — it constructs the
 * full Service against the live registry exactly as the downstream consumer
 * does. Any new entity added to `entity.registry.js` is automatically
 * covered.
 */
describe('EntityRegistry — ElectroDB Service construction', function () {
  // Service construction time scales with entity count — set a generous ceiling
  // so CI machines with slower CPUs don't false-positive on a valid schema.
  this.timeout(10000);

  it('new electrodb.Service(EntityRegistry.getEntities()) succeeds', () => {
    const entities = EntityRegistry.getEntities();

    expect(() => new electrodb.Service(entities)).not.to.throw();
  });

  it('exposes every registered entity on the constructed Service', () => {
    const entities = EntityRegistry.getEntities();
    const service = new electrodb.Service(entities);

    // ElectroDB lower-cases the first character of each entity key on `service.entities`.
    // The registry already stores keys in camelCase form (see EntityRegistry.registerEntity
    // -> decapitalize), so the two maps must align 1:1.
    expect(Object.keys(service.entities).sort())
      .to.deep.equal(Object.keys(entities).sort());
  });
});
