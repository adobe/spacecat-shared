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

// eslint-disable-next-line max-classes-per-file
import type { SlackChannel } from '../models';

/**
 * Represents a Slack client that can be used to interact with the Slack API.
 * It can be used to post messages to a channel, or upload files.
 * @interface
 */
export class BaseSlackClient {
  /**
   * Asynchronous method to create a RUM backlink.

   * @param {object} message - Message payload to be sent to Slack API. see https://api.slack.com/methods/chat.postMessage
   * @returns {Promise<{channelId: string, threadId: string}>} A Promise resolving to
   * an object with the channelId and threadId of the message posted.
   */
  postMessage(message: object): Promise<object>;

  /**
   * Asynchronous method to upload a file to Slack.

   * @param {object} file - An object containing file payload and metadata to be sent to Slack API. see https://slack.dev/node-slack-sdk/web-api#new-way
   * @returns {Promise<fileUrl: string, channels: string[]>} A Promise resolving to
   * an object with the fileUrl and channels of the file posted.
   */
  fileUpload(file: object): Promise<object>;
}

/**
 * Represents a Slack client with elevated privileges, capable of performing
 * advanced operations such as user lookups by email and channel management.
 */
export class ElevatedSlackClient extends BaseSlackClient {
  /**
   * Creates a new Slack channel. The channel can be public or private.
   * Optional parameters include the topic and description of the channel.
   * The creation of the channel is announced in the ops channel. Also, configured
   * admins are invited to the channel.
   *
   * @param {string} name The name of the channel to create. Must start with '#'.
   * @param {string} [topic] Optional. The topic of the channel.
   * @param {string} [description] Optional. The description of the channel.
   * @param {boolean} [isPrivate] Optional. Whether the channel should be private. Default is false.
   * @return {Promise<SlackChannel>} A promise resolving to a SlackChannel object.
   */
  createChannel(
    name: string,
    topic?: string,
    description?: string,
    isPrivate?: boolean,
  ): Promise<SlackChannel>;

  /**
   * Invites a list of users to a channel based on their email addresses,
   * and optionally includes their real names. Users not yet members of the
   * workspace are announced in the ops channel for manual invitation. Single-channel
   * guest users are not invited and announced in the ops channel for manual upgrade
   * to multichannel guest. This is done due to the fact that programmatic upgrade
   * and workspace invite is only available to enterprise grid workspaces, for which
   * this application is not intended.
   *
   * Only users that are not already
   * members of the channel are invited. The list of users is returned with
   * their email addresses and status.
   *
   * @param {string} channelId The ID of the channel.
   * @param {Array<{email: string, realName?: string}>} users The list of users to invite,
   * each with an email and an optional real name.
   * @return {Promise<{ email: string, status: string }[]>} A promise resolving to an array
   * of objects containing the email address and status of each user.
   */
  inviteUsersByEmail(
    channelId: string,
    users: { email: string, realName: string }[],
  ): Promise<{ email: string, status: string }[]>;
}
