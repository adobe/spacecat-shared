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
import { map } from '../../../../src/models/importer/import-model-mapper.js';

describe('import-model-mapper', () => {
  let model;
  let modelMap;

  beforeEach(() => {
    model = {
      id: '123',
      name: 'Test Import',
      func: false,
    };

    modelMap = [
      ['id', 'identification'],
      ['name', 'name'],
      ['func', () => ({ func: true })],
      ['nonExistent', 'nonExistent'],
    ];
  });

  it('should map a model to an API response object', () => {
    const result = map(model, modelMap);
    expect(result).to.deep.equal({
      identification: '123',
      name: 'Test Import',
      func: true,
    });
  });
});
