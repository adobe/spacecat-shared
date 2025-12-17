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
import esmock from 'esmock';

use(sinonChai);
use(chaiAsPromised);

describe('AemClientBuilder', () => {
  let AemClientBuilder;
  let AemBaseClient;
  let FragmentManagement;
  let FragmentVersioning;
  let FragmentTagging;
  let mockClient;
  let logStub;

  beforeEach(async () => {
    logStub = {
      info: stub(),
      error: stub(),
    };

    mockClient = {
      baseUrl: 'https://author.example.com',
      log: logStub,
      request: stub().resolves({}),
    };

    const baseModule = await esmock(
      '../src/aem-client-base.js',
      {
        '@adobe/spacecat-shared-utils': { tracingFetch: stub() },
        '@adobe/spacecat-shared-ims-client': { ImsClient: { createFrom: stub().returns({}) } },
      },
    );
    AemBaseClient = baseModule.AemBaseClient;
    stub(AemBaseClient, 'createFrom').returns(mockClient);

    const builderModule = await esmock(
      '../src/aem-client-builder.js',
      {
        '../src/aem-client-base.js': { AemBaseClient },
      },
    );
    AemClientBuilder = builderModule.AemClientBuilder;

    const sitesModule = await import('../src/sites/index.js');
    FragmentManagement = sitesModule.FragmentManagement;
    FragmentVersioning = sitesModule.FragmentVersioning;
    FragmentTagging = sitesModule.FragmentTagging;
  });

  describe('create', () => {
    it('should create builder from context', () => {
      const context = {
        site: { getDeliveryConfig: () => ({ authorURL: 'https://author.example.com' }) },
        env: {},
        log: logStub,
      };

      const builder = AemClientBuilder.create(context);

      expect(builder).to.be.instanceOf(AemClientBuilder);
      expect(AemBaseClient.createFrom).to.have.been.calledWith(context);
    });
  });

  describe('withManagement', () => {
    it('should add management capability', () => {
      const builder = new AemClientBuilder(mockClient);

      const result = builder.withManagement();

      expect(result).to.equal(builder);
      const client = builder.build();
      expect(client.management).to.be.instanceOf(FragmentManagement);
    });
  });

  describe('withVersioning', () => {
    it('should add versioning capability', () => {
      const builder = new AemClientBuilder(mockClient);

      const result = builder.withVersioning();

      expect(result).to.equal(builder);
      const client = builder.build();
      expect(client.versioning).to.be.instanceOf(FragmentVersioning);
    });
  });

  describe('withTagging', () => {
    it('should add tagging capability', () => {
      const builder = new AemClientBuilder(mockClient);

      const result = builder.withTagging();

      expect(result).to.equal(builder);
      const client = builder.build();
      expect(client.tagging).to.be.instanceOf(FragmentTagging);
    });
  });

  describe('build', () => {
    it('should return built client with client property', () => {
      const builder = new AemClientBuilder(mockClient);

      const built = builder.build();

      expect(built.client).to.equal(mockClient);
    });

    it('should return client with null capabilities when not added', () => {
      const builder = new AemClientBuilder(mockClient);

      const client = builder.build();

      expect(client.management).to.be.null;
      expect(client.versioning).to.be.null;
      expect(client.tagging).to.be.null;
    });

    it('should return client with selected capabilities', () => {
      const builder = new AemClientBuilder(mockClient);

      const client = builder
        .withManagement()
        .withVersioning()
        .build();

      expect(client.management).to.be.instanceOf(FragmentManagement);
      expect(client.versioning).to.be.instanceOf(FragmentVersioning);
      expect(client.tagging).to.be.null;
    });

    it('should return client with all capabilities', () => {
      const builder = new AemClientBuilder(mockClient);

      const client = builder
        .withManagement()
        .withVersioning()
        .withTagging()
        .build();

      expect(client.management).to.be.instanceOf(FragmentManagement);
      expect(client.versioning).to.be.instanceOf(FragmentVersioning);
      expect(client.tagging).to.be.instanceOf(FragmentTagging);
    });

    it('should share client instance across capabilities', () => {
      const builder = new AemClientBuilder(mockClient);

      const built = builder
        .withManagement()
        .withVersioning()
        .withTagging()
        .build();

      expect(built.management.client).to.equal(mockClient);
      expect(built.versioning.client).to.equal(mockClient);
      expect(built.tagging.client).to.equal(mockClient);
    });
  });

  describe('fluent chaining', () => {
    it('should support method chaining', () => {
      const context = {
        site: { getDeliveryConfig: () => ({ authorURL: 'https://author.example.com' }) },
        env: {},
        log: logStub,
      };

      const client = AemClientBuilder.create(context)
        .withManagement()
        .withVersioning()
        .withTagging()
        .build();

      expect(client.client).to.equal(mockClient);
      expect(client.management).to.be.instanceOf(FragmentManagement);
      expect(client.versioning).to.be.instanceOf(FragmentVersioning);
      expect(client.tagging).to.be.instanceOf(FragmentTagging);
    });
  });
});
