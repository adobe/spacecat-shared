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

import type { UniversalContext } from '@adobe/helix-universal';

import type { BaseSlackClient, ElevatedSlackClient } from './clients';
import type { SlackChannel, SlackUser } from './models';

export declare const SLACK_TARGETS: {
  ADOBE_INTERNAL: string;
  ADOBE_EXTERNAL: string;
};

/**
 * Creates a slack client from the given context and for the given target.
 * A client can be designated as elevated, which allows it to perform advanced
 * operations such as user lookups by email and channel management.
 *
 * @param {UniversalContext} context The context to use to create the client.
 * @param {string} target The target to create the client for. See {@link SLACK_TARGETS}.
 * @param {boolean} [isElevated] Optional. Whether the client should be elevated. Default is false.
 */
export declare function createFrom(
  context: UniversalContext,
  target: string,
  isElevated?: boolean
): BaseSlackClient | ElevatedSlackClient;

export default createFrom;

export {
  BaseSlackClient,
  ElevatedSlackClient,
  SlackChannel,
  SlackUser,
};
