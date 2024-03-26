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

import ElevatedSlackClient from '../clients/elevated-slack-client.js';

/**
 * Wrapper function to include an Elevated Slack client on the context object. Client will be
 * available at `context.slack.elevatedClient`.
 *
 * @param {UniversalAction} fn
 * @param {object} opts Options object. Must contain `slackTarget` indicating the target workspace
 * @returns {function(object, UniversalContext): Promise<Response>}
 */
export function elevatedSlackClientWrapper(fn, opts = {}) {
  return async (request, context) => {
    const { slackTarget } = opts;
    if (!context.slack?.elevatedClient) {
      context.slack = context.slack || {};

      context.slack.elevatedClient = ElevatedSlackClient.createFrom(
        context,
        slackTarget,
      );
    }

    return fn(request, context);
  };
}
