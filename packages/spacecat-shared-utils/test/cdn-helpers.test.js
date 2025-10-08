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
import { prettifyLogForwardingConfig } from '../src/cdn-helpers.js';

const FASTLY_LOG_FORMAT = `{
    "timestamp": "%{strftime(\\{"%Y-%m-%dT%H:%M:%S%z"\\}, time.start)}V",
    "host": "%{if(req.http.Fastly-Orig-Host, req.http.Fastly-Orig-Host, req.http.Host)}V",
    "url": "%{json.escape(req.url)}V",
    "request_method": "%{json.escape(req.method)}V",
    "request_referer": "%{json.escape(req.http.referer)}V",
    "request_user_agent": "%{json.escape(req.http.User-Agent)}V",
    "response_status": %{resp.status}V,
    "response_content_type": "%{json.escape(resp.http.Content-Type)}V",
    "client_country_code": "%{client.geo.country_name}V",
    "time_to_first_byte": "%{time.to_first_byte}V"
}`;

describe('CDN Helper Functions', () => {
  describe('prettifyLogForwardingConfig', () => {
    const mockPayload = {
      bucketName: 'cdn-logs-adobe-dev',
      region: 'us-east-1',
      authMethod: 'user_credentials',
      logSource: 'byocdn-fastly',
      allowedPaths: [
        '9E1005A551ED61CA0A490D45@AdobeOrg/raw/byocdn-fastly/',
      ],
      accessKey: 'AKIAZ5TC4XVOZ65PV3X2',
      secretKey: 'somesecret',
      message: 'Retrieved existing S3 bucket for organization: 9E1005A551ED61CA0A490D45@AdobeOrg (ID: 9E1005A551ED61CA0A490D45@AdobeOrg). Successfully created new credentials.',
    };

    const mockCloudFrontPayload = {
      bucketName: 'cdn-logs-adobe-dev',
      region: 'us-east-1',
      authMethod: 'user_credentials',
      logSource: 'byocdn-cloudfront',
      allowedPaths: [
        '9E1005A551ED61CA0A490D45@AdobeOrg/raw/byocdn-cloudfront/',
      ],
      deliveryDestinationArn: 'arn:aws:logs:us-east-1:123456789012:delivery-destination:cdn-logs-EXAMPLE123AdobeOrg',
      deliveryDestinationName: 'cdn-logs-EXAMPLE123AdobeOrg',
      message: 'Retrieved existing S3 bucket for organization: 9E1005A551ED61CA0A490D45@AdobeOrg (ID: 9E1005A551ED61CA0A490D45@AdobeOrg). Successfully created new credentials.',
    };

    describe('byocdn-fastly transformations', () => {
      it('should transform payload for byocdn-fastly', () => {
        const result = prettifyLogForwardingConfig({ ...mockPayload, logSource: 'byocdn-fastly' });

        expect(result).to.deep.equal({
          'Bucket Name': 'cdn-logs-adobe-dev',
          Domain: 's3.us-east-1.amazonaws.com',
          Path: '9E1005A551ED61CA0A490D45@AdobeOrg/raw/byocdn-fastly/%Y/%m/%d/%H/',
          'Timestamp Format': '%Y-%m-%dT%H:%M:%S.000',
          Placement: 'Format Version Default',
          'Log format': FASTLY_LOG_FORMAT,
          'Access method': 'User credentials',
          'Access key': 'AKIAZ5TC4XVOZ65PV3X2',
          'Secret key': 'somesecret',
          Period: 300,
          'Log line format': 'Blank',
          Compression: 'Gzip',
          'Redundancy level': 'Standard',
          ACL: 'None',
          'Server side encryption': 'None',
          'Maximum bytes': 0,
        });
      });

      it('should handle multiple allowed paths for byocdn-fastly', () => {
        const payloadWithMultiplePaths = {
          ...mockPayload,
          logSource: 'byocdn-fastly',
          allowedPaths: [
            'org1/raw/byocdn-fastly/',
            'org2/raw/byocdn-fastly/',
          ],
        };

        const result = prettifyLogForwardingConfig(payloadWithMultiplePaths);

        // Should use the first path only
        expect(result.Path).to.equal('org1/raw/byocdn-fastly/%Y/%m/%d/%H/');
      });
    });

    describe('other CDN types', () => {
      it('should handle byocdn-akamai', () => {
        const result = prettifyLogForwardingConfig({ ...mockPayload, logSource: 'byocdn-akamai' });
        expect(result).to.deep.equal({
          'Bucket Name': 'cdn-logs-adobe-dev',
          Region: 'us-east-1',
          Path: '9E1005A551ED61CA0A490D45@AdobeOrg/raw/byocdn-fastly/{%Y}/{%m}/{%d}/{%H}',
          'Logged Properties': [
            'reqTimeSec',
            'country',
            'reqHost',
            'reqPath',
            'queryStr',
            'reqMethod',
            'ua',
            'statusCode',
            'referer',
            'rspContentType',
            'timeToFirstByte',
          ],
          'Log file prefix': '{%Y}-{%m}-{%d}T{%H}:{%M}:{%S}.000',
          'Log file suffix': '.log',
          'Log interval': '60 seconds',
          'Access key': 'AKIAZ5TC4XVOZ65PV3X2',
          'Secret key': 'somesecret',
        });
      });

      it('should handle byocdn-cloudflare', () => {
        const result = prettifyLogForwardingConfig({ ...mockPayload, logSource: 'byocdn-cloudflare' });
        expect(result).to.deep.equal({
          'Bucket Name': 'cdn-logs-adobe-dev',
          Region: 'us-east-1',
          Path: '9E1005A551ED61CA0A490D45@AdobeOrg/raw/byocdn-fastly/{DATE}/',
          'Timestamp format': 'RFC3339',
          'Sampling rate': 'All logs',
          'Organize logs into daily subfolders': 'Yes',
          'Logged Properties': [
            'EdgeStartTimestamp',
            'ClientCountry',
            'ClientRequestHost',
            'ClientRequestURI',
            'ClientRequestMethod',
            'ClientRequestUserAgent',
            'EdgeResponseStatus',
            'ClientRequestReferer',
            'EdgeResponseContentType',
            'EdgeTimeToFirstByteMs',
          ],
          'Ownership token': 'Please reach out to Adobe support for obtaining the token once you completed the configuration.',
        });
      });

      it('should handle byocdn-cloudfront', () => {
        const result = prettifyLogForwardingConfig(mockCloudFrontPayload);
        expect(result).to.deep.equal({
          'Bucket Name': 'cdn-logs-adobe-dev',
          Region: 'us-east-1',
          'Delivery destination ARN': 'arn:aws:logs:us-east-1:123456789012:delivery-destination:cdn-logs-EXAMPLE123AdobeOrg',
          'Delivery Destination Name': 'cdn-logs-EXAMPLE123AdobeOrg',
          'Destination AWS Account ID': '640168421876',
          'Path suffix': '/{yyyy}/{MM}/{dd}/{HH}',
          'Logged Properties': [
            'date',
            'time',
            'x-edge-location',
            'cs-method',
            'x-host-header',
            'cs-uri-stem',
            'sc-status',
            'cs(Referer)',
            'cs(User-Agent)',
            'time-to-first-byte',
            'sc-content-type',
          ],
        });
      });

      it('should handle ams-cloudfront', () => {
        const result = prettifyLogForwardingConfig({ ...mockCloudFrontPayload, logSource: 'ams-cloudfront' });
        expect(result).to.deep.equal({
          'Bucket Name': 'cdn-logs-adobe-dev',
          Region: 'us-east-1',
          'Delivery destination ARN': 'arn:aws:logs:us-east-1:123456789012:delivery-destination:cdn-logs-EXAMPLE123AdobeOrg',
          'Delivery Destination Name': 'cdn-logs-EXAMPLE123AdobeOrg',
          'Destination AWS Account ID': '640168421876',
          'Path suffix': '/{yyyy}/{MM}/{dd}/{HH}',
          'Logged Properties': [
            'date',
            'time',
            'x-edge-location',
            'cs-method',
            'x-host-header',
            'cs-uri-stem',
            'sc-status',
            'cs(Referer)',
            'cs(User-Agent)',
            'time-to-first-byte',
            'sc-content-type',
          ],
        });
      });
    });

    describe('error handling', () => {
      it('should throw error when payload is null', () => {
        expect(() => prettifyLogForwardingConfig(null)).to.throw(
          'payload is required as input',
        );
      });

      it('should throw error when logSource is missing from payload', () => {
        const payloadWithoutLogSource = { ...mockPayload };
        delete payloadWithoutLogSource.logSource;
        expect(() => prettifyLogForwardingConfig(payloadWithoutLogSource)).to.throw(
          'logSource is required in payload',
        );
      });

      it('should throw error when bucketName is missing from payload', () => {
        const payloadWithoutBucketName = { ...mockPayload };
        delete payloadWithoutBucketName.bucketName;
        expect(() => prettifyLogForwardingConfig(payloadWithoutBucketName)).to.throw(
          'bucketName is required in payload',
        );
      });

      it('should throw error when region is missing from payload', () => {
        const payloadWithoutRegion = { ...mockPayload };
        delete payloadWithoutRegion.region;
        expect(() => prettifyLogForwardingConfig(payloadWithoutRegion)).to.throw(
          'region is required in payload',
        );
      });

      it('should throw error when authMethod is missing from payload', () => {
        const payloadWithoutAuthMethod = { ...mockPayload };
        delete payloadWithoutAuthMethod.authMethod;
        expect(() => prettifyLogForwardingConfig(payloadWithoutAuthMethod)).to.throw(
          'authMethod is required in payload',
        );
      });

      it('should throw error when allowedPaths is missing from payload', () => {
        const payloadWithoutAllowedPaths = { ...mockPayload };
        delete payloadWithoutAllowedPaths.allowedPaths;
        expect(() => prettifyLogForwardingConfig(payloadWithoutAllowedPaths)).to.throw(
          'allowedPaths is required in payload',
        );
      });

      it('should throw error when accessKey is missing for byocdn-fastly', () => {
        const payloadWithoutAccessKey = { ...mockPayload };
        delete payloadWithoutAccessKey.accessKey;
        expect(() => prettifyLogForwardingConfig(payloadWithoutAccessKey)).to.throw(
          'accessKey is required in payload',
        );
      });

      it('should throw error when secretKey is missing for byocdn-fastly', () => {
        const payloadWithoutSecretKey = { ...mockPayload };
        delete payloadWithoutSecretKey.secretKey;
        expect(() => prettifyLogForwardingConfig(payloadWithoutSecretKey)).to.throw(
          'secretKey is required in payload',
        );
      });

      it('should throw error when accessKey is missing for byocdn-akamai', () => {
        const payloadWithoutAccessKey = { ...mockPayload, logSource: 'byocdn-akamai' };
        delete payloadWithoutAccessKey.accessKey;
        expect(() => prettifyLogForwardingConfig(payloadWithoutAccessKey)).to.throw(
          'accessKey is required in payload',
        );
      });

      it('should throw error when secretKey is missing for byocdn-akamai', () => {
        const payloadWithoutSecretKey = { ...mockPayload, logSource: 'byocdn-akamai' };
        delete payloadWithoutSecretKey.secretKey;
        expect(() => prettifyLogForwardingConfig(payloadWithoutSecretKey)).to.throw(
          'secretKey is required in payload',
        );
      });

      it('should throw error when deliveryDestinationArn is missing for byocdn-cloudfront', () => {
        const payloadWithoutDeliveryDestinationArn = { ...mockCloudFrontPayload };
        delete payloadWithoutDeliveryDestinationArn.deliveryDestinationArn;
        expect(() => prettifyLogForwardingConfig(payloadWithoutDeliveryDestinationArn)).to.throw(
          'deliveryDestinationArn is required in payload',
        );
      });

      it('should throw error when deliveryDestinationArn is missing for ams-cloudfront', () => {
        const payloadWithoutDeliveryDestinationArn = { ...mockCloudFrontPayload, logSource: 'ams-cloudfront' };
        delete payloadWithoutDeliveryDestinationArn.deliveryDestinationArn;
        expect(() => prettifyLogForwardingConfig(payloadWithoutDeliveryDestinationArn)).to.throw(
          'deliveryDestinationArn is required in payload',
        );
      });

      it('should not require accessKey/secretKey for byocdn-cloudflare', () => {
        const payloadWithoutCredentials = { ...mockPayload, logSource: 'byocdn-cloudflare' };
        delete payloadWithoutCredentials.accessKey;
        delete payloadWithoutCredentials.secretKey;
        // Should not throw error
        expect(() => prettifyLogForwardingConfig(payloadWithoutCredentials)).to.not.throw();
      });

      it('should not require deliveryDestinationName for byocdn-fastly', () => {
        const payloadWithoutDeliveryDestination = { ...mockPayload };
        delete payloadWithoutDeliveryDestination.deliveryDestinationName;
        // Should not throw error
        expect(() => prettifyLogForwardingConfig(payloadWithoutDeliveryDestination)).to.not.throw();
      });

      it('should throw error for unsupported logSource', () => {
        expect(() => prettifyLogForwardingConfig({ ...mockPayload, logSource: 'unsupported-cdn' })).to.throw(
          'Unsupported log source: unsupported-cdn',
        );
      });

      it('should list supported types in error message', () => {
        try {
          prettifyLogForwardingConfig({ ...mockPayload, logSource: 'invalid' });
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
          logSource: 'byocdn-fastly',
          allowedPaths: [...mockPayload.allowedPaths],
        };
        const originalAllowedPaths = [...mockPayload.allowedPaths];

        prettifyLogForwardingConfig(originalPayload);

        expect(originalPayload.allowedPaths).to.deep.equal(originalAllowedPaths);
        // Verify original payload doesn't have the transformed fields
        expect(originalPayload['Bucket Name']).to.be.undefined;
        expect(originalPayload.Domain).to.be.undefined;
        expect(originalPayload.Path).to.be.undefined;
      });
    });
  });
});
