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

import BaseSlackClient from './clients/base-slack-client.js';
import ElevatedSlackClient, { SLACK_STATUSES } from './clients/elevated-slack-client.js';
import { elevatedSlackClientWrapper } from './wrappers/elevated-client-wrapper.js';

const SLACK_TARGETS = {
  WORKSPACE_INTERNAL: 'WORKSPACE_INTERNAL',
  WORKSPACE_EXTERNAL: 'WORKSPACE_EXTERNAL',
};

export {
  SLACK_STATUSES,
  SLACK_TARGETS,
  BaseSlackClient,
  ElevatedSlackClient,
  elevatedSlackClientWrapper,
};
