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
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import { FragmentVersioning, AemRequestError } from '../../src/index.js';

use(sinonChai);
use(chaiAsPromised);

describe('FragmentVersioning', () => {
  let fragmentVersioning;
  let clientMock;

  beforeEach(() => {
    clientMock = {
      log: { info: stub(), error: stub() },
      request: stub(),
    };

    fragmentVersioning = new FragmentVersioning(clientMock);
  });

  describe('constructor', () => {
    it('should store client reference', () => {
      expect(fragmentVersioning.client).to.equal(clientMock);
    });
  });

  describe('createVersion', () => {
    it('should create version with empty payload when no options provided', async () => {
      clientMock.request.resolves({ versionId: 'version-1' });

      const result = await fragmentVersioning.createVersion('fragment-123');

      expect(clientMock.request).to.have.been.calledWith(
        'POST',
        '/adobe/sites/cf/fragments/fragment-123/versions',
        {},
      );
      expect(result).to.deep.equal({ versionId: 'version-1' });
    });

    it('should create version with label only', async () => {
      clientMock.request.resolves({ versionId: 'version-1' });

      await fragmentVersioning.createVersion('fragment-123', { label: 'v1.0' });

      expect(clientMock.request).to.have.been.calledWith(
        'POST',
        '/adobe/sites/cf/fragments/fragment-123/versions',
        { label: 'v1.0' },
      );
    });

    it('should create version with comment only', async () => {
      clientMock.request.resolves({ versionId: 'version-1' });

      await fragmentVersioning.createVersion('fragment-123', { comment: 'Initial version' });

      expect(clientMock.request).to.have.been.calledWith(
        'POST',
        '/adobe/sites/cf/fragments/fragment-123/versions',
        { comment: 'Initial version' },
      );
    });

    it('should create version with both label and comment', async () => {
      clientMock.request.resolves({ versionId: 'version-1' });

      await fragmentVersioning.createVersion('fragment-123', {
        label: 'v1.0',
        comment: 'Initial version',
      });

      expect(clientMock.request).to.have.been.calledWith(
        'POST',
        '/adobe/sites/cf/fragments/fragment-123/versions',
        { label: 'v1.0', comment: 'Initial version' },
      );
    });

    it('should handle empty options object', async () => {
      clientMock.request.resolves({ versionId: 'version-1' });

      await fragmentVersioning.createVersion('fragment-123', {});

      expect(clientMock.request).to.have.been.calledWith(
        'POST',
        '/adobe/sites/cf/fragments/fragment-123/versions',
        {},
      );
    });

    it('should propagate request errors', async () => {
      clientMock.request.rejects(new AemRequestError(500, 'Internal Server Error'));

      await expect(fragmentVersioning.createVersion('fragment-123'))
        .to.be.rejectedWith(AemRequestError);
    });
  });
});
