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

import { expect } from 'chai';
import { parentIdField } from '../../mock/parent-id.js';

describe('parent-id', () => {
  it('yields { parent_id } for a non-empty parent (a child tag)', () => {
    expect(parentIdField('tag-root')).to.deep.equal({ parent_id: 'tag-root' });
  });

  it('yields {} for an empty/absent parent (a root tag carries no parent_id)', () => {
    expect(parentIdField('')).to.deep.equal({});
    expect(parentIdField(undefined)).to.deep.equal({});
    expect(parentIdField(null)).to.deep.equal({});
  });
});
