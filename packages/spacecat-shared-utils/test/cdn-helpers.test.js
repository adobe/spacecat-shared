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
import { prettifyLogForwardingConfig, formatRelativeTime } from '../src/cdn-helpers.js';

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
  describe('formatRelativeTime', () => {
    it('should return "today" for current date', () => {
      const now = new Date();
      const result = formatRelativeTime(now.toISOString());
      expect(result).to.equal('today');
    });

    it('should return "1 day ago" for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = formatRelativeTime(yesterday.toISOString());
      expect(result).to.equal('1 day ago');
    });

    it('should return "2 days ago" for two days ago', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const result = formatRelativeTime(twoDaysAgo.toISOString());
      expect(result).to.equal('2 days ago');
    });

    it('should return "30 days ago" for 30 days ago', () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const result = formatRelativeTime(thirtyDaysAgo.toISOString());
      expect(result).to.equal('30 days ago');
    });

    it('should return "364 days ago" for 364 days ago', () => {
      const date = new Date();
      date.setDate(date.getDate() - 364);
      const result = formatRelativeTime(date.toISOString());
      expect(result).to.equal('364 days ago');
    });

    it('should return "more than 1 year ago" for exactly 365 days ago', () => {
      const date = new Date();
      date.setDate(date.getDate() - 365);
      const result = formatRelativeTime(date.toISOString());
      expect(result).to.equal('more than 1 year ago');
    });

    it('should return "more than 1 year ago" for 400 days ago', () => {
      const date = new Date();
      date.setDate(date.getDate() - 400);
      const result = formatRelativeTime(date.toISOString());
      expect(result).to.equal('more than 1 year ago');
    });

    it('should return "more than 2 years ago" for 730 days ago', () => {
      const date = new Date();
      date.setDate(date.getDate() - 730);
      const result = formatRelativeTime(date.toISOString());
      expect(result).to.equal('more than 2 years ago');
    });

    it('should return "more than 3 years ago" for 1095 days ago', () => {
      const date = new Date();
      date.setDate(date.getDate() - 1095);
      const result = formatRelativeTime(date.toISOString());
      expect(result).to.equal('more than 3 years ago');
    });

    it('should return empty string for null timestamp', () => {
      const result = formatRelativeTime(null);
      expect(result).to.equal('');
    });

    it('should return empty string for undefined timestamp', () => {
      const result = formatRelativeTime(undefined);
      expect(result).to.equal('');
    });

    it('should return empty string for empty string timestamp', () => {
      const result = formatRelativeTime('');
      expect(result).to.equal('');
    });

    it('should handle ISO 8601 timestamp with milliseconds', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const result = formatRelativeTime(twoDaysAgo.toISOString());
      expect(result).to.equal('2 days ago');
    });
  });

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
          'Access Key': 'AKIAZ5TC4XVOZ65PV3X2',
          'Secret Key': 'somesecret',
          Period: 300,
          'Log line format': 'Blank',
          Compression: 'Gzip',
          'Redundancy level': 'Standard',
          ACL: 'None',
          'Server side encryption': 'None',
          'Maximum bytes': 0,
          HelpUrl: 'https://www.fastly.com/documentation/guides/integrations/logging-endpoints/log-streaming-amazon-s3/',
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

      it('should handle empty allowed paths array for byocdn-fastly', () => {
        const payloadWithEmptyPaths = {
          ...mockPayload,
          logSource: 'byocdn-fastly',
          allowedPaths: [],
        };

        const result = prettifyLogForwardingConfig(payloadWithEmptyPaths);

        // Should use empty string as prefix
        expect(result.Path).to.equal('%Y/%m/%d/%H/');
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
          'Log format': 'JSON',
          'Log interval': '60 seconds',
          'Access Key': 'AKIAZ5TC4XVOZ65PV3X2',
          'Secret Key': 'somesecret',
          HelpUrl: 'https://techdocs.akamai.com/datastream2/docs/stream-amazon-s3',
        });
      });

      it('should handle byocdn-cloudflare without ownership token', () => {
        const result = prettifyLogForwardingConfig({ ...mockPayload, logSource: 'byocdn-cloudflare' });
        expect(result).to.deep.equal({
          'Bucket Name': 'cdn-logs-adobe-dev',
          Region: 'us-east-1',
          Path: '9E1005A551ED61CA0A490D45@AdobeOrg/raw/byocdn-fastly/',
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
          'Log format': 'JSON',
          'Ownership token': 'token-available-after-deployment',
          HelpUrl: 'https://developers.cloudflare.com/logs/logpush/logpush-job/enable-destinations/aws-s3/',
        });
      });

      it('should handle byocdn-cloudflare with ownership token', () => {
        const payloadWithToken = { ...mockPayload, logSource: 'byocdn-cloudflare', ownershipToken: 'abc123token4567' };
        const result = prettifyLogForwardingConfig(payloadWithToken);
        expect(result['Ownership token']).to.equal('abc123token4567');
      });

      it('should handle byocdn-cloudfront', () => {
        const result = prettifyLogForwardingConfig(mockCloudFrontPayload);
        expect(result).to.deep.equal({
          'Bucket Name': 'cdn-logs-adobe-dev',
          Region: 'us-east-1',
          'Delivery destination ARN': 'arn:aws:logs:us-east-1:123456789012:delivery-destination:cdn-logs-EXAMPLE123AdobeOrg',
          'Delivery Destination Name': 'cdn-logs-EXAMPLE123AdobeOrg',
          'Destination AWS Account ID': '640168421876',
          'Output file format': 'JSON',
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
          HelpUrl: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/standard-logging.html#enable-standard-logging-cross-accounts',
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
          'Output file format': 'JSON',
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
          HelpUrl: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/standard-logging.html#enable-standard-logging-cross-accounts',
        });
      });

      it('should handle byocdn-imperva', () => {
        const impervaPayload = {
          ...mockPayload,
          logSource: 'byocdn-imperva',
          allowedPaths: ['9E1005A551ED61CA0A490D45@AdobeOrg/raw/byocdn-imperva/'],
        };
        const result = prettifyLogForwardingConfig(impervaPayload);
        expect(result).to.deep.equal({
          'Log integration mode': 'Push mode',
          'Delivery method': 'Amazon S3 ARN',
          'Bucket Name': 'cdn-logs-adobe-dev',
          Region: 'us-east-1',
          Path: '9E1005A551ED61CA0A490D45@AdobeOrg/raw/byocdn-imperva/',
          'Log types': 'Cloud WAF',
          'Log level': 'Access logs',
          Format: 'W3C',
          'Compress logs': 'Yes',
          HelpUrl: 'https://docs-cybersec.thalesgroup.com/bundle/cloud-application-security/page/siem-log-configuration.htm',
        });
      });

      it('should handle byocdn-other', () => {
        const otherPayload = {
          ...mockPayload,
          logSource: 'byocdn-other',
          allowedPaths: ['9E1005A551ED61CA0A490D45@AdobeOrg/raw/byocdn-other/'],
        };
        const result = prettifyLogForwardingConfig(otherPayload);
        expect(result).to.deep.equal({
          'Bucket name': 'cdn-logs-adobe-dev',
          Region: 'us-east-1',
          Path: '9E1005A551ED61CA0A490D45@AdobeOrg/raw/byocdn-other/<year>/<month>/<day>',
          'Access Key': 'AKIAZ5TC4XVOZ65PV3X2',
          'Secret Key': 'somesecret',
          'Timestamp format': 'RFC3339',
          'Log format': 'JSON lines (one log per line)',
          Compression: 'Optional, but prefered. Please use Gzip compression if you decide to compress the log files.',
          'Example of valid log line': '{"timestamp":"2025-12-01T13:00:05Z","host":"www.example.com","url":"/docs/getting-started","request_method":"GET","request_user_agent":"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)","response_status":200,"request_referer":"https://www.chatgpt.com/","response_content_type":"text/html; charset=utf-8","time_to_first_byte":123}',
        });
      });

      it('should handle empty allowed paths array for byocdn-akamai', () => {
        const payloadWithEmptyPaths = {
          ...mockPayload,
          logSource: 'byocdn-akamai',
          allowedPaths: [],
        };

        const result = prettifyLogForwardingConfig(payloadWithEmptyPaths);
        expect(result.Path).to.equal('{%Y}/{%m}/{%d}/{%H}');
      });

      it('should handle empty allowed paths array for byocdn-cloudflare', () => {
        const payloadWithEmptyPaths = {
          ...mockPayload,
          logSource: 'byocdn-cloudflare',
          allowedPaths: [],
        };
        delete payloadWithEmptyPaths.accessKey;
        delete payloadWithEmptyPaths.secretKey;

        const result = prettifyLogForwardingConfig(payloadWithEmptyPaths);
        expect(result.Path).to.equal('');
      });
    });

    describe('error handling', () => {
      it('should throw error when payload is null', () => {
        expect(() => prettifyLogForwardingConfig(null)).to.throw(
          'payload is required as input',
        );
      });

      it('should throw error when payload is undefined', () => {
        expect(() => prettifyLogForwardingConfig(undefined)).to.throw(
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

      it('should throw error when accessKey/currentAccessKey is missing for byocdn-fastly', () => {
        const payloadWithoutAccessKey = { ...mockPayload };
        delete payloadWithoutAccessKey.accessKey;
        expect(() => prettifyLogForwardingConfig(payloadWithoutAccessKey)).to.throw(
          'accessKey or currentAccessKey is required in payload',
        );
      });

      it('should throw error when secretKey/currentSecretKey is missing for byocdn-fastly', () => {
        const payloadWithoutSecretKey = { ...mockPayload };
        delete payloadWithoutSecretKey.secretKey;
        expect(() => prettifyLogForwardingConfig(payloadWithoutSecretKey)).to.throw(
          'secretKey or currentSecretKey is required in payload',
        );
      });

      it('should throw error when accessKey/currentAccessKey is missing for byocdn-akamai', () => {
        const payloadWithoutAccessKey = { ...mockPayload, logSource: 'byocdn-akamai' };
        delete payloadWithoutAccessKey.accessKey;
        expect(() => prettifyLogForwardingConfig(payloadWithoutAccessKey)).to.throw(
          'accessKey or currentAccessKey is required in payload',
        );
      });

      it('should throw error when secretKey/currentSecretKey is missing for byocdn-akamai', () => {
        const payloadWithoutSecretKey = { ...mockPayload, logSource: 'byocdn-akamai' };
        delete payloadWithoutSecretKey.secretKey;
        expect(() => prettifyLogForwardingConfig(payloadWithoutSecretKey)).to.throw(
          'secretKey or currentSecretKey is required in payload',
        );
      });

      it('should throw error when accessKey/currentAccessKey is missing for byocdn-other', () => {
        const payloadWithoutAccessKey = { ...mockPayload, logSource: 'byocdn-other' };
        delete payloadWithoutAccessKey.accessKey;
        expect(() => prettifyLogForwardingConfig(payloadWithoutAccessKey)).to.throw(
          'accessKey or currentAccessKey is required in payload',
        );
      });

      it('should throw error when secretKey/currentSecretKey is missing for byocdn-other', () => {
        const payloadWithoutSecretKey = { ...mockPayload, logSource: 'byocdn-other' };
        delete payloadWithoutSecretKey.secretKey;
        expect(() => prettifyLogForwardingConfig(payloadWithoutSecretKey)).to.throw(
          'secretKey or currentSecretKey is required in payload',
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

      it('should throw error when deliveryDestinationName is missing for byocdn-cloudfront', () => {
        const payloadWithoutDeliveryDestinationName = { ...mockCloudFrontPayload };
        delete payloadWithoutDeliveryDestinationName.deliveryDestinationName;
        expect(() => prettifyLogForwardingConfig(payloadWithoutDeliveryDestinationName)).to.throw(
          'deliveryDestinationName is required in payload',
        );
      });

      it('should throw error when deliveryDestinationName is missing for ams-cloudfront', () => {
        const payloadWithoutDeliveryDestinationName = { ...mockCloudFrontPayload, logSource: 'ams-cloudfront' };
        delete payloadWithoutDeliveryDestinationName.deliveryDestinationName;
        expect(() => prettifyLogForwardingConfig(payloadWithoutDeliveryDestinationName)).to.throw(
          'deliveryDestinationName is required in payload',
        );
      });

      it('should not require accessKey/secretKey for byocdn-cloudflare', () => {
        const payloadWithoutCredentials = { ...mockPayload, logSource: 'byocdn-cloudflare' };
        delete payloadWithoutCredentials.accessKey;
        delete payloadWithoutCredentials.secretKey;
        // Should not throw error
        expect(() => prettifyLogForwardingConfig(payloadWithoutCredentials)).to.not.throw();
      });

      it('should not require accessKey/secretKey for byocdn-imperva', () => {
        const payloadWithoutCredentials = { ...mockPayload, logSource: 'byocdn-imperva' };
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

    describe('credential backwards compatibility', () => {
      it('should support old format with accessKey and secretKey for byocdn-fastly', () => {
        const result = prettifyLogForwardingConfig({ ...mockPayload, logSource: 'byocdn-fastly' });

        expect(result['Access Key']).to.equal('AKIAZ5TC4XVOZ65PV3X2');
        expect(result['Secret Key']).to.equal('somesecret');
        expect(result['Access Key (current)']).to.be.undefined;
        expect(result['Secret Key (current)']).to.be.undefined;
      });

      it('should support new format with currentAccessKey and currentSecretKey for byocdn-fastly', () => {
        const newFormatPayload = {
          ...mockPayload,
          logSource: 'byocdn-fastly',
          currentAccessKey: 'AKIAZ5TC4XVOZ65PV3X3',
          currentSecretKey: 'newsecret',
        };
        delete newFormatPayload.accessKey;
        delete newFormatPayload.secretKey;

        const result = prettifyLogForwardingConfig(newFormatPayload);

        expect(result['Access Key (current)']).to.equal('AKIAZ5TC4XVOZ65PV3X3');
        expect(result['Secret Key (current)']).to.equal('newsecret');
        expect(result['Access Key']).to.be.undefined;
        expect(result['Secret Key']).to.be.undefined;
      });

      it('should show both current and old credentials when both are provided for byocdn-fastly', () => {
        const payloadWithBothCredentials = {
          ...mockPayload,
          logSource: 'byocdn-fastly',
          currentAccessKey: 'AKIAZ5TC4XVOZ65PV3X3',
          currentSecretKey: 'newsecret',
          oldAccessKey: 'AKIAZ5TC4XVOZ65PV3X2',
          oldSecretKey: 'oldsecret',
        };
        delete payloadWithBothCredentials.accessKey;
        delete payloadWithBothCredentials.secretKey;

        const result = prettifyLogForwardingConfig(payloadWithBothCredentials);

        expect(result['Access Key (current)']).to.equal('AKIAZ5TC4XVOZ65PV3X3');
        expect(result['Secret Key (current)']).to.equal('newsecret');
        expect(result['Access Key (to be retired)']).to.equal('AKIAZ5TC4XVOZ65PV3X2');
        expect(result['Secret Key (to be retired)']).to.equal('oldsecret');
      });

      it('should format timestamp fields when provided for byocdn-fastly', () => {
        const now = new Date();
        const today = now.toISOString();
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
        const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000).toISOString();

        const payloadWithTimestamps = {
          ...mockPayload,
          logSource: 'byocdn-fastly',
          currentAccessKey: 'AKIAZ5TC4XVOZ65PV3X3',
          currentSecretKey: 'newsecret',
          oldAccessKey: 'AKIAZ5TC4XVOZ65PV3X2',
          oldSecretKey: 'oldsecret',
          currentCredentialsCreatedAt: twoDaysAgo,
          currentCredentialsLastUsed: today,
          oldCredentialsCreatedAt: twoYearsAgo,
          oldCredentialsLastUsed: oneYearAgo,
        };
        delete payloadWithTimestamps.accessKey;
        delete payloadWithTimestamps.secretKey;

        const result = prettifyLogForwardingConfig(payloadWithTimestamps);

        expect(result.currentCredentialsCreatedAt).to.equal('2 days ago');
        expect(result.currentCredentialsLastUsed).to.equal('today');
        expect(result.oldCredentialsCreatedAt).to.equal('more than 2 years ago');
        expect(result.oldCredentialsLastUsed).to.match(/^(365 days ago|more than 1 year ago)$/);
      });

      it('should show both current and old credentials when both are provided for byocdn-akamai', () => {
        const payloadWithBothCredentials = {
          ...mockPayload,
          logSource: 'byocdn-akamai',
          currentAccessKey: 'AKIAZ5TC4XVOZ65PV3X3',
          currentSecretKey: 'newsecret',
          oldAccessKey: 'AKIAZ5TC4XVOZ65PV3X2',
          oldSecretKey: 'oldsecret',
        };
        delete payloadWithBothCredentials.accessKey;
        delete payloadWithBothCredentials.secretKey;

        const result = prettifyLogForwardingConfig(payloadWithBothCredentials);

        expect(result['Access Key (current)']).to.equal('AKIAZ5TC4XVOZ65PV3X3');
        expect(result['Secret Key (current)']).to.equal('newsecret');
        expect(result['Access Key (to be retired)']).to.equal('AKIAZ5TC4XVOZ65PV3X2');
        expect(result['Secret Key (to be retired)']).to.equal('oldsecret');
      });

      it('should show both current and old credentials when both are provided for byocdn-other', () => {
        const payloadWithBothCredentials = {
          ...mockPayload,
          logSource: 'byocdn-other',
          currentAccessKey: 'AKIAZ5TC4XVOZ65PV3X3',
          currentSecretKey: 'newsecret',
          oldAccessKey: 'AKIAZ5TC4XVOZ65PV3X2',
          oldSecretKey: 'oldsecret',
          allowedPaths: ['9E1005A551ED61CA0A490D45@AdobeOrg/raw/byocdn-other/'],
        };
        delete payloadWithBothCredentials.accessKey;
        delete payloadWithBothCredentials.secretKey;

        const result = prettifyLogForwardingConfig(payloadWithBothCredentials);

        expect(result['Access Key (current)']).to.equal('AKIAZ5TC4XVOZ65PV3X3');
        expect(result['Secret Key (current)']).to.equal('newsecret');
        expect(result['Access Key (to be retired)']).to.equal('AKIAZ5TC4XVOZ65PV3X2');
        expect(result['Secret Key (to be retired)']).to.equal('oldsecret');
      });
    });
  });
});
