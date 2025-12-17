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
import {
  FragmentManagement,
  FragmentNotFoundError,
  FragmentStateError,
  AemRequestError,
} from '../../src/index.js';

use(sinonChai);
use(chaiAsPromised);

describe('FragmentManagement', () => {
  let fragmentManagement;
  let clientMock;

  beforeEach(() => {
    clientMock = {
      log: { info: stub(), error: stub() },
      request: stub(),
    };

    fragmentManagement = new FragmentManagement(clientMock);
  });

  describe('constructor', () => {
    it('should store client reference', () => {
      expect(fragmentManagement.client).to.equal(clientMock);
    });
  });

  describe('resolveFragmentId', () => {
    it('should resolve fragment ID from path', async () => {
      clientMock.request.resolves({
        items: [{ id: 'fragment-123' }],
      });

      const result = await fragmentManagement.resolveFragmentId('/content/dam/test');

      expect(clientMock.request).to.have.been.calledWith(
        'GET',
        '/adobe/sites/cf/fragments?path=%2Fcontent%2Fdam%2Ftest&limit=1',
      );
      expect(result).to.equal('fragment-123');
    });

    it('should throw FragmentNotFoundError when no items returned', async () => {
      clientMock.request.resolves({ items: [] });

      try {
        await fragmentManagement.resolveFragmentId('/content/dam/nonexistent');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(FragmentNotFoundError);
        expect(error.fragmentPath).to.equal('/content/dam/nonexistent');
      }
    });

    it('should throw FragmentNotFoundError when result is null', async () => {
      clientMock.request.resolves(null);

      try {
        await fragmentManagement.resolveFragmentId('/content/dam/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(FragmentNotFoundError);
      }
    });

    it('should throw FragmentNotFoundError when items is undefined', async () => {
      clientMock.request.resolves({});

      try {
        await fragmentManagement.resolveFragmentId('/content/dam/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(FragmentNotFoundError);
      }
    });

    it('should propagate request errors', async () => {
      clientMock.request.rejects(new AemRequestError(500, 'Internal Server Error'));

      await expect(fragmentManagement.resolveFragmentId('/content/dam/test'))
        .to.be.rejectedWith(AemRequestError);
    });
  });

  describe('createFragment', () => {
    it('should create fragment with correct payload', async () => {
      const createdFragment = { id: 'new-fragment-123', title: 'Test Fragment' };
      clientMock.request.resolves(createdFragment);

      const data = {
        title: 'Test Fragment',
        name: 'test-fragment',
        modelId: 'model-123',
        fields: [{ name: 'field1', value: 'value1' }],
      };

      const result = await fragmentManagement.createFragment('/content/dam/parent', data);

      expect(clientMock.request).to.have.been.calledWith(
        'POST',
        '/adobe/sites/cf/fragments',
        {
          title: 'Test Fragment',
          name: 'test-fragment',
          modelId: 'model-123',
          parentPath: '/content/dam/parent',
          fields: [{ name: 'field1', value: 'value1' }],
        },
      );
      expect(result).to.deep.equal(createdFragment);
    });

    it('should propagate request errors', async () => {
      clientMock.request.rejects(new AemRequestError(500, 'Internal Server Error'));

      await expect(fragmentManagement.createFragment('/content/dam/parent', {}))
        .to.be.rejectedWith(AemRequestError);
    });
  });

  describe('getFragment', () => {
    it('should get fragment by path', async () => {
      const fragment = { id: 'fragment-123', title: 'Test', etag: 'etag-abc' };

      clientMock.request
        .onFirstCall().resolves({ items: [{ id: 'fragment-123' }] })
        .onSecondCall()
        .resolves(fragment);

      const result = await fragmentManagement.getFragment('/content/dam/test');

      expect(clientMock.request).to.have.been.calledTwice;
      expect(clientMock.request.secondCall).to.have.been.calledWith(
        'GET',
        '/adobe/sites/cf/fragments/fragment-123',
      );
      expect(result).to.deep.equal(fragment);
    });

    it('should propagate resolveFragmentId errors', async () => {
      clientMock.request.resolves({ items: [] });

      try {
        await fragmentManagement.getFragment('/content/dam/nonexistent');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(FragmentNotFoundError);
      }
    });

    it('should propagate request errors', async () => {
      clientMock.request
        .onFirstCall().resolves({ items: [{ id: 'fragment-123' }] })
        .onSecondCall()
        .rejects(new AemRequestError(500, 'Internal Server Error'));

      await expect(fragmentManagement.getFragment('/content/dam/test'))
        .to.be.rejectedWith(AemRequestError);
    });
  });

  describe('getFragmentById', () => {
    it('should get fragment by ID', async () => {
      const fragment = { id: 'fragment-123', title: 'Test', etag: 'etag-abc' };

      clientMock.request.resolves(fragment);

      const result = await fragmentManagement.getFragmentById('fragment-123');

      expect(clientMock.request).to.have.been.calledWith(
        'GET',
        '/adobe/sites/cf/fragments/fragment-123',
      );
      expect(result).to.deep.equal(fragment);
    });

    it('should propagate request errors', async () => {
      clientMock.request.rejects(new AemRequestError(404, 'Not Found'));

      await expect(fragmentManagement.getFragmentById('fragment-123'))
        .to.be.rejectedWith(AemRequestError);
    });
  });

  describe('patchFragmentById', () => {
    it('should patch fragment with correct headers', async () => {
      const fragment = { id: 'fragment-123', etag: 'etag-abc' };
      const updatedFragment = { id: 'fragment-123', title: 'Updated' };
      const patches = [{ op: 'replace', path: '/title', value: 'Updated' }];

      clientMock.request
        .onCall(0).resolves(fragment)
        .onCall(1).resolves(updatedFragment);

      const result = await fragmentManagement.patchFragmentById('fragment-123', patches);

      expect(clientMock.request.getCall(1)).to.have.been.calledWith(
        'PATCH',
        '/adobe/sites/cf/fragments/fragment-123',
        patches,
        {
          'If-Match': 'etag-abc',
          'Content-Type': 'application/json-patch+json',
        },
      );
      expect(result).to.deep.equal(updatedFragment);
    });

    it('should throw FragmentStateError when etag is missing', async () => {
      const fragmentWithoutEtag = { id: 'fragment-123' };
      const patches = [{ op: 'replace', path: '/title', value: 'Updated' }];

      clientMock.request.resolves(fragmentWithoutEtag);

      try {
        await fragmentManagement.patchFragmentById('fragment-123', patches);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(FragmentStateError);
        expect(error.fragmentPath).to.equal('fragment-123');
        expect(error.reason).to.equal('missing ETag');
      }
    });

    it('should throw FragmentStateError when fragment is null', async () => {
      const patches = [{ op: 'replace', path: '/title', value: 'Updated' }];
      clientMock.request.resolves(null);

      try {
        await fragmentManagement.patchFragmentById('fragment-123', patches);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(FragmentStateError);
      }
    });

    it('should propagate request errors', async () => {
      const fragment = { id: 'fragment-123', etag: 'etag-abc' };
      const patches = [{ op: 'replace', path: '/title', value: 'Updated' }];

      clientMock.request
        .onCall(0).resolves(fragment)
        .onCall(1).rejects(new AemRequestError(500, 'Internal Server Error'));

      await expect(fragmentManagement.patchFragmentById('fragment-123', patches))
        .to.be.rejectedWith(AemRequestError);
    });
  });

  describe('deleteFragmentById', () => {
    it('should delete fragment with correct headers', async () => {
      const fragment = { id: 'fragment-123', etag: 'etag-abc' };

      clientMock.request
        .onCall(0).resolves(fragment)
        .onCall(1).resolves(null);

      const result = await fragmentManagement.deleteFragmentById('fragment-123');

      expect(clientMock.request.getCall(1)).to.have.been.calledWith(
        'DELETE',
        '/adobe/sites/cf/fragments/fragment-123',
        null,
        {
          'If-Match': 'etag-abc',
        },
      );
      expect(result).to.be.null;
    });

    it('should throw FragmentStateError when etag is missing', async () => {
      const fragmentWithoutEtag = { id: 'fragment-123' };

      clientMock.request.resolves(fragmentWithoutEtag);

      try {
        await fragmentManagement.deleteFragmentById('fragment-123');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(FragmentStateError);
        expect(error.reason).to.equal('missing ETag');
      }
    });

    it('should throw FragmentStateError when fragment is null', async () => {
      clientMock.request.resolves(null);

      try {
        await fragmentManagement.deleteFragmentById('fragment-123');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(FragmentStateError);
      }
    });

    it('should propagate request errors', async () => {
      const fragment = { id: 'fragment-123', etag: 'etag-abc' };

      clientMock.request
        .onCall(0).resolves(fragment)
        .onCall(1).rejects(new AemRequestError(500, 'Internal Server Error'));

      await expect(fragmentManagement.deleteFragmentById('fragment-123'))
        .to.be.rejectedWith(AemRequestError);
    });
  });

  describe('patchFragment (path-based)', () => {
    it('should resolve path and delegate to patchFragmentById', async () => {
      const fragment = { id: 'fragment-123', etag: 'etag-abc' };
      const updatedFragment = { id: 'fragment-123', title: 'Updated' };
      const patches = [{ op: 'replace', path: '/title', value: 'Updated' }];

      clientMock.request
        .onCall(0)
        .resolves({ items: [{ id: 'fragment-123' }] })
        .onCall(1)
        .resolves(fragment)
        .onCall(2)
        .resolves(updatedFragment);

      const result = await fragmentManagement.patchFragment('/content/dam/test', patches);

      expect(result).to.deep.equal(updatedFragment);
    });
  });

  describe('deleteFragment (path-based)', () => {
    it('should resolve path and delegate to deleteFragmentById', async () => {
      const fragment = { id: 'fragment-123', etag: 'etag-abc' };

      clientMock.request
        .onCall(0)
        .resolves({ items: [{ id: 'fragment-123' }] })
        .onCall(1)
        .resolves(fragment)
        .onCall(2)
        .resolves(null);

      const result = await fragmentManagement.deleteFragment('/content/dam/test');

      expect(result).to.be.null;
    });
  });
});
