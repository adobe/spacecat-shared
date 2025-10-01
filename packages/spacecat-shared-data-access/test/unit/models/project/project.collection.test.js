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

import { expect } from 'chai';
import { ProjectCollection } from '../../../../src/models/project/index.js';
import { createElectroMocks } from '../../util.js';

describe('ProjectCollection', () => {
  let projectCollection;

  beforeEach(() => {
    const mockRecord = {
      projectId: 'test-project-id',
      projectName: 'Test Project',
      organizationId: 'test-org-id',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    ({
      collection: projectCollection,
    } = createElectroMocks(ProjectCollection, mockRecord));
  });

  describe('inherited methods', () => {
    it('should have access to base collection methods', () => {
      expect(projectCollection).to.have.property('all');
      expect(projectCollection).to.have.property('findById');
      expect(projectCollection).to.have.property('create');
      expect(projectCollection).to.have.property('allByIndexKeys');
      expect(projectCollection).to.have.property('findByIndexKeys');
    });
  });
});
