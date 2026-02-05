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

import type { LDOptions, LDContext, LDFlagValue } from '@launchdarkly/node-server-sdk';

export interface LaunchDarklyConfig {
  sdkKey: string;
  options?: LDOptions;
}

export interface UniversalContext {
  env: {
    LAUNCHDARKLY_SDK_KEY: string;
    [key: string]: any;
  };
  log: {
    info: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
  };
}

export interface Logger {
  info: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
}

export declare class LaunchDarklyClient {
  constructor(config: LaunchDarklyConfig, log?: Logger);

  static createFrom(context: UniversalContext): LaunchDarklyClient;

  init(): Promise<void>;

  variation(flagKey: string, context: LDContext, defaultValue: LDFlagValue): Promise<LDFlagValue>;

  isFlagEnabledForIMSOrg(
    flagKey: string,
    imsOrgId: string,
    userKey?: string
  ): Promise<boolean>;
}

export { LaunchDarklyClient as default };
