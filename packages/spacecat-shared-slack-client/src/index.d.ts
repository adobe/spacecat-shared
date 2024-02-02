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

import type { BaseSlackClient, ElevatedSlackClient } from './clients';
import type { SlackChannel, SlackUser } from './models';

export declare const SLACK_TARGETS: {
  WORKSPACE_INTERNAL: string;
  WORKSPACE_EXTERNAL: string;
};

/**
 * The possible statuses for a user invites and channel creations.
 */
export declare const SLACK_STATUSES : {
  USER_ALREADY_IN_CHANNEL: string;
  GENERAL_ERROR: string;
  USER_ALREADY_IN_ANOTHER_CHANNEL: string;
  USER_INVITED_TO_CHANNEL: string;
  USER_NEEDS_INVITATION_TO_WORKSPACE: string;
  CHANNEL_ALREADY_EXISTS: string;
};

export {
  BaseSlackClient,
  ElevatedSlackClient,
  SlackChannel,
  SlackUser,
};
