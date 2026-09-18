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

import { hasText } from '@adobe/spacecat-shared-utils';

const REQUIRED_CONFIG_KEYS = ['region'];

/**
 * A client for the AWS CloudFront control plane used by Spacecat's
 * Optimize-at-Edge onboarding.
 *
 * This is the initial package skeleton (Phase 1). Its only job is to establish
 * the published `@adobe/spacecat-shared-cloudfront-client` package and its npm
 * OIDC trusted-publisher binding. The operational API (distribution, cache
 * behavior, and function-association management) is migrated in from
 * `@adobe/spacecat-shared-tokowaka-client` in a follow-up (Phase 2).
 *
 * Docs: https://docs.aws.amazon.com/cloudfront/latest/APIReference/
 */
export default class CloudFrontClient {
  /**
   * Creates a CloudFrontClient from a Universal context. Reads the target AWS
   * region from context.env: AWS_REGION. Credentials are resolved by the
   * ambient AWS credential chain (IAM role) and will be added here as explicit
   * config in Phase 2, when the underlying AWS SDK client is introduced.
   *
   * @param {object} context - Universal function context
   * @returns {CloudFrontClient}
   */
  static createFrom(context) {
    const { env, log = console } = context;
    return new CloudFrontClient({ region: env.AWS_REGION }, log);
  }

  /**
   * @param {object} config
   * @param {string} config.region - AWS region for the CloudFront control plane.
   * @param {object} [log]
   */
  constructor(config = {}, log = console) {
    REQUIRED_CONFIG_KEYS.forEach((key) => {
      if (!hasText(config[key])) {
        throw new Error(`CloudFrontClient requires ${key}`);
      }
    });
    this.region = config.region;
    this.log = log;
  }
}
