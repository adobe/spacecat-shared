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
import { prettifyLogForwardingConfig } from '../src/browser.js';

describe('Browser Module', () => {
  describe('exports', () => {
    it('should export prettifyLogForwardingConfig function', () => {
      expect(prettifyLogForwardingConfig).to.be.a('function');
    });

    it('should correctly transform a Fastly payload', () => {
      const payload = {
        bucketName: 'test-bucket',
        region: 'us-east-1',
        authMethod: 'user_credentials',
        logSource: 'byocdn-fastly',
        allowedPaths: ['org/raw/byocdn-fastly/'],
        accessKey: 'TESTKEY',
        secretKey: 'testsecret',
      };

      const result = prettifyLogForwardingConfig(payload);

      expect(result).to.have.property('Bucket Name', 'test-bucket');
      expect(result).to.have.property('Domain', 's3.us-east-1.amazonaws.com');
      expect(result).to.have.property('Access Key', 'TESTKEY');
      expect(result).to.have.property('Secret Key', 'testsecret');
    });

    it('should correctly transform a CloudFront payload', () => {
      const payload = {
        bucketName: 'test-bucket',
        region: 'us-east-1',
        authMethod: 'user_credentials',
        logSource: 'byocdn-cloudfront',
        allowedPaths: ['org/raw/byocdn-cloudfront/'],
        deliveryDestinationArn: 'arn:aws:logs:us-east-1:123456789012:delivery-destination:test',
        deliveryDestinationName: 'test-destination',
      };

      const result = prettifyLogForwardingConfig(payload);

      expect(result).to.have.property('Bucket Name', 'test-bucket');
      expect(result).to.have.property('Region', 'us-east-1');
      expect(result).to.have.property('Delivery destination ARN', 'arn:aws:logs:us-east-1:123456789012:delivery-destination:test');
    });

    it('should throw error for invalid payload', () => {
      expect(() => prettifyLogForwardingConfig(null)).to.throw(
        'payload is required as input',
      );
    });
  });
});
