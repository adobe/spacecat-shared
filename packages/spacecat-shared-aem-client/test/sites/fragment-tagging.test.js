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
  FragmentTagging,
  FragmentStateError,
  AemRequestError,
} from '../../src/index.js';

use(sinonChai);
use(chaiAsPromised);

describe('FragmentTagging', () => {
  let tagging;
  let clientMock;

  beforeEach(() => {
    clientMock = {
      log: { info: stub(), error: stub() },
      request: stub(),
    };

    tagging = new FragmentTagging(clientMock);
  });

  describe('constructor', () => {
    it('should store client reference', () => {
      expect(tagging.client).to.equal(clientMock);
    });
  });

  describe('getTags', () => {
    it('should get tags for a fragment', async () => {
      const fragmentId = 'fragment-123';
      const tagsResponse = {
        items: [
          { id: 'namespace:tag1', title: 'Tag 1' },
          { id: 'namespace:tag2', title: 'Tag 2' },
        ],
      };

      clientMock.request.resolves(tagsResponse);

      const result = await tagging.getTags(fragmentId);

      expect(clientMock.request).to.have.been.calledWith(
        'GET',
        `/adobe/sites/cf/fragments/${fragmentId}/tags`,
      );
      expect(result).to.deep.equal(tagsResponse);
    });

    it('should handle empty tags response', async () => {
      const fragmentId = 'fragment-123';
      clientMock.request.resolves({ items: [] });

      const result = await tagging.getTags(fragmentId);

      expect(result.items).to.have.lengthOf(0);
    });

    it('should propagate request errors', async () => {
      clientMock.request.rejects(new AemRequestError(500, 'Internal Server Error'));

      await expect(tagging.getTags('fragment-123'))
        .to.be.rejectedWith(AemRequestError);
    });
  });

  describe('addTags', () => {
    it('should add tags to a fragment', async () => {
      const fragmentId = 'fragment-123';
      const tagIds = ['namespace:tag1', 'namespace:tag2'];
      const response = { items: [{ id: 'namespace:tag1' }, { id: 'namespace:tag2' }] };

      clientMock.request.resolves(response);

      const result = await tagging.addTags(fragmentId, tagIds);

      expect(clientMock.request).to.have.been.calledWith(
        'POST',
        `/adobe/sites/cf/fragments/${fragmentId}/tags`,
        { tags: tagIds },
      );
      expect(result).to.deep.equal(response);
    });

    it('should propagate request errors', async () => {
      clientMock.request.rejects(new AemRequestError(500, 'Internal Server Error'));

      await expect(tagging.addTags('fragment-123', ['namespace:tag1']))
        .to.be.rejectedWith(AemRequestError);
    });
  });

  describe('replaceTags', () => {
    it('should replace tags on a fragment using tags ETag', async () => {
      const fragmentId = 'fragment-123';
      const tagIds = ['namespace:newTag'];
      const tagsEtag = '"tags-etag-value"';
      const getTagsResponse = { items: [{ id: 'namespace:oldTag' }], etag: tagsEtag };
      const putResponse = { items: [{ id: 'namespace:newTag' }] };

      clientMock.request
        .onFirstCall().resolves(getTagsResponse)
        .onSecondCall().resolves(putResponse);

      const result = await tagging.replaceTags(fragmentId, tagIds);

      expect(clientMock.request.firstCall).to.have.been.calledWith(
        'GET',
        `/adobe/sites/cf/fragments/${fragmentId}/tags`,
      );
      expect(clientMock.request.secondCall).to.have.been.calledWith(
        'PUT',
        `/adobe/sites/cf/fragments/${fragmentId}/tags`,
        { tags: tagIds },
        {
          'If-Match': tagsEtag,
          'Content-Type': 'application/json',
        },
      );
      expect(result).to.deep.equal(putResponse);
    });

    it('should throw FragmentStateError when tags response has no etag', async () => {
      const fragmentId = 'fragment-123';
      const tagIds = ['namespace:tag1'];

      clientMock.request.resolves({ items: [] }); // No etag

      await expect(tagging.replaceTags(fragmentId, tagIds))
        .to.be.rejectedWith(FragmentStateError, /missing ETag for tags/);
    });

    it('should throw FragmentStateError when tags response is null', async () => {
      const fragmentId = 'fragment-123';
      const tagIds = ['namespace:tag1'];

      clientMock.request.resolves(null);

      await expect(tagging.replaceTags(fragmentId, tagIds))
        .to.be.rejectedWith(FragmentStateError, /missing ETag for tags/);
    });

    it('should propagate request errors', async () => {
      clientMock.request
        .onFirstCall().resolves({ items: [], etag: '"tags-etag"' })
        .onSecondCall().rejects(new AemRequestError(500, 'Internal Server Error'));

      await expect(tagging.replaceTags('fragment-123', ['namespace:tag1']))
        .to.be.rejectedWith(AemRequestError);
    });

    it('should allow empty tagIds array for removing all tags via replace', async () => {
      const fragmentId = 'fragment-123';
      const tagIds = [];
      const tagsEtag = '"tags-etag-value"';

      clientMock.request
        .onFirstCall().resolves({ items: [{ id: 'namespace:oldTag' }], etag: tagsEtag })
        .onSecondCall().resolves({ items: [] });

      const result = await tagging.replaceTags(fragmentId, tagIds);

      expect(clientMock.request.secondCall).to.have.been.calledWith(
        'PUT',
        `/adobe/sites/cf/fragments/${fragmentId}/tags`,
        { tags: [] },
        {
          'If-Match': tagsEtag,
          'Content-Type': 'application/json',
        },
      );
      expect(result.items).to.have.lengthOf(0);
    });
  });

  describe('deleteTags', () => {
    it('should delete all tags from a fragment using tags ETag', async () => {
      const fragmentId = 'fragment-123';
      const tagsEtag = '"tags-etag-value"';

      clientMock.request
        .onFirstCall().resolves({ items: [{ id: 'namespace:tag1' }], etag: tagsEtag })
        .onSecondCall().resolves();

      await tagging.deleteTags(fragmentId);

      expect(clientMock.request.firstCall).to.have.been.calledWith(
        'GET',
        `/adobe/sites/cf/fragments/${fragmentId}/tags`,
      );
      expect(clientMock.request.secondCall).to.have.been.calledWith(
        'DELETE',
        `/adobe/sites/cf/fragments/${fragmentId}/tags`,
        null,
        {
          'If-Match': tagsEtag,
        },
      );
    });

    it('should throw FragmentStateError when tags response has no etag', async () => {
      const fragmentId = 'fragment-123';

      clientMock.request.resolves({ items: [] }); // No etag

      await expect(tagging.deleteTags(fragmentId))
        .to.be.rejectedWith(FragmentStateError);
    });

    it('should throw FragmentStateError when tags response is null', async () => {
      const fragmentId = 'fragment-123';

      clientMock.request.resolves(null);

      await expect(tagging.deleteTags(fragmentId))
        .to.be.rejectedWith(FragmentStateError);
    });

    it('should propagate request errors', async () => {
      clientMock.request
        .onFirstCall().resolves({ items: [], etag: '"tags-etag"' })
        .onSecondCall().rejects(new AemRequestError(500, 'Internal Server Error'));

      await expect(tagging.deleteTags('fragment-123'))
        .to.be.rejectedWith(AemRequestError);
    });
  });
});
