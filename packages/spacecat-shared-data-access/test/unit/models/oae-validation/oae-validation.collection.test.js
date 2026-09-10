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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';

import OaeValidation from '../../../../src/models/oae-validation/oae-validation.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);

describe('OaeValidationCollection', () => {
  let collection;

  const mockRecord = {
    jobId: 'c4c2d3f1-2b3c-5d4e-9f0a-2345678901bc',
    suggestionId: 'd5d3e4f2-3c4d-6e5f-0a1b-3456789012cd',
    status: 'IN_PROGRESS',
    type: 'routing',
  };

  beforeEach(() => {
    ({ collection } = createElectroMocks(OaeValidation, mockRecord));
    collection.allByIndexKeys = stub();
  });

  describe('allByJobId', () => {
    it('gets all rows for a job ID', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedRecords = [
        {
          jobId, suggestionId: 'sugg-1', status: 'COMPLETE', type: 'routing',
        },
        {
          jobId, suggestionId: 'sugg-2', status: 'IN_PROGRESS', type: 'routing',
        },
      ];

      collection.allByIndexKeys.resolves(expectedRecords);

      const result = await collection.allByJobId(jobId);

      expect(collection.allByIndexKeys).to.have.been.calledOnceWith({ jobId });
      expect(result).to.deep.equal(expectedRecords);
    });

    it('throws when jobId is not provided', async () => {
      await expect(collection.allByJobId(null))
        .to.be.rejectedWith('jobId must be a valid UUID');
      await expect(collection.allByJobId(''))
        .to.be.rejectedWith('jobId must be a valid UUID');
      await expect(collection.allByJobId(undefined))
        .to.be.rejectedWith('jobId must be a valid UUID');
    });

    it('handles empty results', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174001';
      collection.allByIndexKeys.resolves([]);

      const result = await collection.allByJobId(jobId);

      expect(result).to.be.an('array').that.is.empty;
    });

    it('propagates errors from allByIndexKeys', async () => {
      const error = new Error('Database connection failed');
      collection.allByIndexKeys.rejects(error);

      await expect(collection.allByJobId('123e4567-e89b-12d3-a456-426614174002'))
        .to.be.rejectedWith('Database connection failed');
    });
  });
});
