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
import { transformCDNSetup } from '../src/cdn-helpers.js';

describe('CDN Helper Functions', () => {
  describe('transformCDNSetup', () => {
    const mockPayload = {
      bucketName: 'cdn-logs-adobe-dev',
      region: 'us-east-1',
      authMethod: 'user_credentials',
      allowedPaths: [
        '9E1005A551ED61CA0A490D45@AdobeOrg/raw/byocdn-fastly/',
      ],
      accessKey: 'AKIAZ5TC4XVOZ65PV3X2',
      secretKey: 'somesecret',
      message: 'Retrieved existing S3 bucket for organization: 9E1005A551ED61CA0A490D45@AdobeOrg (ID: 9E1005A551ED61CA0A490D45@AdobeOrg). Successfully created new credentials.',
    };

    describe('byocdn-fastly transformations', () => {
      it('should transform payload for byocdn-fastly', () => {
        const result = transformCDNSetup(mockPayload, 'byocdn-fastly');

        expect(result).to.deep.equal({
          bucketName: 'cdn-logs-adobe-dev',
          region: 'us-east-1',
          authMethod: 'user_credentials',
          allowedPaths: [
            '9E1005A551ED61CA0A490D45@AdobeOrg/raw/byocdn-fastly/additional/path',
          ],
          accessKey: 'AKIAZ5TC4XVOZ65PV3X2',
          secretKey: 'somesecret',
          message: 'Retrieved existing S3 bucket for organization: 9E1005A551ED61CA0A490D45@AdobeOrg (ID: 9E1005A551ED61CA0A490D45@AdobeOrg). Successfully created new credentials.',
          newField: 'somejson',
        });
      });

      it('should handle multiple allowed paths for byocdn-fastly', () => {
        const payloadWithMultiplePaths = {
          ...mockPayload,
          allowedPaths: [
            'org1/raw/byocdn-fastly/',
            'org2/raw/byocdn-fastly/',
          ],
        };

        const result = transformCDNSetup(payloadWithMultiplePaths, 'byocdn-fastly');

        expect(result.allowedPaths).to.deep.equal([
          'org1/raw/byocdn-fastly/additional/path',
          'org2/raw/byocdn-fastly/additional/path',
        ]);
      });

      it('should handle missing allowedPaths for byocdn-fastly', () => {
        const payloadWithoutPaths = {
          bucketName: 'cdn-logs-adobe-dev',
          region: 'us-east-1',
        };

        const result = transformCDNSetup(payloadWithoutPaths, 'byocdn-fastly');

        expect(result.allowedPaths).to.deep.equal([]);
        expect(result.newField).to.equal('somejson');
      });
    });

    describe('other CDN types', () => {
      it('should handle byocdn-akamai', () => {
        const result = transformCDNSetup(mockPayload, 'byocdn-akamai');
        expect(result).to.deep.equal(mockPayload);
      });

      it('should handle byocdn-cloudflare', () => {
        const result = transformCDNSetup(mockPayload, 'byocdn-cloudflare');
        expect(result).to.deep.equal(mockPayload);
      });

      it('should handle byocdn-cloudfront', () => {
        const result = transformCDNSetup(mockPayload, 'byocdn-cloudfront');
        expect(result).to.deep.equal(mockPayload);
      });

      it('should handle ams-cloudfront', () => {
        const result = transformCDNSetup(mockPayload, 'ams-cloudfront');
        expect(result).to.deep.equal(mockPayload);
      });
    });

    describe('error handling', () => {
      it('should throw error when logSource is missing', () => {
        expect(() => transformCDNSetup(mockPayload, null)).to.throw(
          'logSource parameter is required',
        );
      });

      it('should throw error when logSource is undefined', () => {
        expect(() => transformCDNSetup(mockPayload)).to.throw(
          'logSource parameter is required',
        );
      });

      it('should throw error for unsupported logSource', () => {
        expect(() => transformCDNSetup(mockPayload, 'unsupported-cdn')).to.throw(
          'Unsupported log source: unsupported-cdn',
        );
      });

      it('should list supported types in error message', () => {
        try {
          transformCDNSetup(mockPayload, 'invalid');
        } catch (error) {
          expect(error.message).to.include('byocdn-fastly');
          expect(error.message).to.include('byocdn-akamai');
          expect(error.message).to.include('byocdn-cloudflare');
          expect(error.message).to.include('byocdn-cloudfront');
          expect(error.message).to.include('ams-cloudfront');
        }
      });
    });

    describe('immutability', () => {
      it('should not mutate the original payload', () => {
        const originalPayload = {
          ...mockPayload,
          allowedPaths: [...mockPayload.allowedPaths],
        };
        const originalAllowedPaths = [...mockPayload.allowedPaths];

        transformCDNSetup(originalPayload, 'byocdn-fastly');

        expect(originalPayload.allowedPaths).to.deep.equal(originalAllowedPaths);
        expect(originalPayload.newField).to.be.undefined;
      });
    });
  });
});
