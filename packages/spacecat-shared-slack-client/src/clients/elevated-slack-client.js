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

import { hasText } from '@adobe/spacecat-shared-utils';

import SlackChannel from '../models/slack-channel.js';
import SlackTeam from '../models/slack-team.js';
import SlackUser from '../models/slack-user.js';

import BaseSlackClient from './base-slack-client.js';

/**
 * The possible statuses for a user invites and channel creations.
 *
 * @type {{
 * USER_ALREADY_IN_CHANNEL: string,
 * GENERAL_ERROR: string,
 * USER_ALREADY_IN_ANOTHER_CHANNEL: string,
 * USER_INVITED_TO_CHANNEL: string,
 * USER_NEEDS_INVITATION_TO_WORKSPACE: string,
 * CHANNEL_ALREADY_EXISTS: string
 * }}
 */
export const SLACK_STATUSES = {
  USER_ALREADY_IN_CHANNEL: 'user_already_in_channel',
  USER_ALREADY_IN_ANOTHER_CHANNEL: 'user_already_in_another_channel',
  USER_INVITED_TO_CHANNEL: 'user_invited_to_channel',
  USER_NEEDS_INVITATION_TO_WORKSPACE: 'user_needs_invitation_to_workspace',
  CHANNEL_ALREADY_EXISTS: 'channel_already_exists',
  GENERAL_ERROR: 'general_error',
};

/**
 * Creates an error with a code.
 *
 * @private This method is private and should not be called directly.
 * @param {string} message The error message.
 * @param {string} code The error code.
 * @return {Error} The error.
 */
function createErrorWithCode(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * A Slack client with elevated privileges. This client can be used to invite users to the workspace
 * and channels. It can also be used to create channels.
 */
export default class ElevatedSlackClient extends BaseSlackClient {
  /**
   * Creates a new Slack client with elevated privileges.
   *
   * @constructor This constructor should not be called directly.
   * Use the factory method instead.
   * @param {string} token The Slack token to use for API calls.
   * @param {object} opsConfig The ops configuration.
   * @param {string} opsConfig.opsChannelId The ID of the ops channel.
   * @param {string[]} opsConfig.admins The list of admin user IDs.
   * @param {Object} log The logger object.
   */
  constructor(token, opsConfig, log) {
    super(token, opsConfig, log);
    this.isInitialized = false;
    this.team = null;
    this.threadId = null;
  }

  /**
   * Retrieves the self information for the workspace.
   * Required scopes: none
   * Returns a payload like this:
   * {
   *     "ok": true,
   *     "url": "https://subarachnoid.slack.com/",
   *     "team": "Subarachnoid Workspace",
   *     "user": "grace",
   *     "team_id": "T12345678",
   *     "user_id": "W12345678"
   * }
   *
   * @private This method is private and should not be called directly.
   * @return {Promise<SlackUser>}
   */
  async #getSelf() {
    try {
      const response = await this._apiCall('auth.test');
      const { user_id: id, team_id, user: name } = response; // eslint-disable-line camelcase
      return SlackUser.create({
        id,
        team_id, // eslint-disable-line camelcase
        name,
        is_bot: true,
      });
    } catch (e) {
      this.log.error('Failed to retrieve self information', e);
      throw e;
    }
  }

  /**
   * Retrieves the team information for the workspace.
   * Required scopes: team:read
   *
   * @private This method is private and should not be called directly.
   * @return {Promise<Object>} The team information.
   */
  async #getTeam() {
    try {
      const response = await this._apiCall('team.info');
      return SlackTeam.create(response.team);
    } catch (e) {
      this.log.error('Failed to retrieve workspace information', e);
      throw e;
    }
  }

  /**
   * Initializes the Slack client. This method must be called before any other method.
   *
   * @private This method is private and should not be called directly.
   * @return {Promise<void>} A promise that resolves when the client is initialized.
   */
  async #initialize() {
    if (this.isInitialized) {
      this.log.debug('Slack client already initialized');
      return;
    }

    try {
      const startTime = process.hrtime.bigint();

      this.self = await this.#getSelf();
      this.team = await this.#getTeam();
      this.isInitialized = true;

      this._logDuration('Slack client initialized', startTime);
    } catch (e) {
      this.log.error('Failed to initialize Slack client', e);
      throw e;
    }
  }

  /**
   * Adds the configured admins to the specified channel.
   *
   * @private This method is private and should not be called directly.
   * @param {string} channelId The ID of the channel to add the admins to.
   * @return {Promise<void>} A promise that resolves when the admins have been added.
   */
  async #addAdminsToChannel(channelId) {
    const invitePromises = this.opsConfig.admins
      .map((admin) => this.#inviteUserToChannel(admin, channelId));

    const inviteResults = await Promise.allSettled(invitePromises);
    inviteResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        this.log.info(`Successfully invited admin to channel: ${result.value}`);
      } else {
        this.log.error(`Failed to invite admin to channel: ${result.reason}`);
      }
    });
  }

  /**
   * Looks up a Slack user by their email address. This is useful in scenarios
   * where user identification is based on email addresses rather than Slack user IDs.
   * This method requires the 'users:read.email' scope.
   *
   * @private This method is private and should not be called directly.
   * @param {string} email The email address of the user to look up.
   * @returns {Promise<SlackUser|null>} A promise resolving to a SlackUser object,
   * or null if no user with the specified email address was found.
   */
  async #findUserByEmail(email) {
    if (!hasText(email)) {
      throw new Error('Email is required');
    }

    await this.#initialize();

    try {
      const response = await this._apiCall('users.lookupByEmail', { email });
      return SlackUser.create(response.user);
    } catch (e) {
      if (e.data?.error === 'users_not_found') {
        return null;
      } else {
        this.log.error(`Failed to find user with email ${email}`, e);
        throw e;
      }
    }
  }

  /**
   * Retrieves a list of channels that a specified user is a member of.
   *
   * @private This method is private and should not be called directly.
   * @param {string} userId The ID of the user whose channel memberships are to be retrieved.
   * @returns {Promise<Array<SlackChannel>>} A promise resolving to an array of Channel objects.
   */
  async #getUserChannels(userId) {
    if (!hasText(userId)) {
      throw new Error('User ID is required');
    }

    await this.#initialize();

    let channels = [];
    let cursor = '';
    do {
      try {
        // in this case we are dependent on the result of the previous iteration
        // eslint-disable-next-line no-await-in-loop
        const response = await this._apiCall('users.conversations', {
          user: userId,
          cursor,
          team_id: this.team.getId(),
          exclude_archived: true,
        });
        channels = channels.concat(response.channels);
        cursor = response.response_metadata.next_cursor;
      } catch (e) {
        this.log.error(`Failed to retrieve channels for user ${userId}`, e);
        throw e;
      }
    } while (cursor);

    return channels.map((channelData) => SlackChannel.create(channelData));
  }

  /**
   * Handles the user invite logic. If the user is not found, they are invited to the workspace.
   * If the user is found, they are invited to the channel.
   *
   * @private This method is private and should not be called directly.
   * @param {string} channelId The ID of the channel to invite the user to.
   * @param {Array<{email: string, realName: string}>} users The users to invite.
   * @return {Promise<{email: string, status: string}[]>}
   */
  async #handleUserInvites(channelId, users) {
    const invitePromises = users.map((user) => this.#processUserInvite(user, channelId)
      .then((status) => ({ email: user.email, status }))
      .catch((error) => ({
        email: user.email,
        status: 'Failed to invite',
        error,
      })));

    let results = await Promise.allSettled(invitePromises);
    results = results.map((result) => result.value);

    // Handle users needing workspace invitation
    await this.#handleUserStatusNotification(
      results,
      SLACK_STATUSES.USER_NEEDS_INVITATION_TO_WORKSPACE,
      'The following users need to be invited to the workspace',
    );

    // Handle users already in channel
    await this.#handleUserStatusNotification(
      results,
      SLACK_STATUSES.USER_ALREADY_IN_ANOTHER_CHANNEL,
      'The following users need upgrade to multichannel user',
    );

    return results;
  }

  /**
   * Handles user status notifications.
   *
   * @private This method is private and should not be called directly.
   * @param {Array<{email: string, status: string}>} results The results of the user invites.
   * @param {string} status The status to filter by.
   * @param {string} messagePrefix The message prefix.
   * @return {Promise<void>} A promise that resolves when the notifications are posted.
   */
  async #handleUserStatusNotification(results, status, messagePrefix) {
    const filteredUsers = results.filter((result) => result.status === status);

    if (filteredUsers.length > 0) {
      const emails = filteredUsers.map((result) => `${result.email}`).join(', ');
      this.log.warn(`${messagePrefix}: ${emails}`);
      await this.#postMessageToOpsChannel(`${messagePrefix}: ${emails}`);
    }
  }

  /**
   * Invites a user to the given channel.
   *
   * @private This method is private and should not be called directly.
   * @param {string} userId The ID of the user to invite. {@link SlackUser#getId
   * @param {string} channelId The ID of the channel to invite the user to.
   * @return {Promise<WebAPICallResult>} A promise that resolves to the status of the invite.
   */
  async #inviteUserToChannel(userId, channelId) {
    return this._apiCall('conversations.invite', { channel: channelId, users: userId });
  }

  /**
   * Posts a message to the ops channel. If no ops channel is configured, the message is not posted.
   *
   * @private This method is private and should not be called directly.
   * @param {string} message The message to post.
   * @return {Promise<void>} A promise that resolves when the message is posted.
   */
  async #postMessageToOpsChannel(message) {
    if (!hasText(this.opsConfig.opsChannelId)) {
      this.log.warn('No ops channel configured, cannot post message');
      return;
    }

    try {
      const result = await this.postMessage({
        channel: this.opsConfig.opsChannelId,
        text: message,
        thread_ts: this.threadId || '',
      });

      if (!hasText(this.threadId)) {
        this.threadId = `${result.threadId}`;
      }
    } catch (e) {
      this.log.error('Failed to post message to ops channel', e);
    }
  }

  /**
   * Invites a user to the given channel.
   *
   * @private This method is private and should not be called directly.
   * @param {SlackUser} user The user to invite.
   * @param {string} channelId The ID of the channel to invite the user to.
   * @return {Promise<string>} A promise that resolves to the status of the invite.
   */
  async #processUserInvite(user, channelId) {
    try {
      const startTime = process.hrtime.bigint();
      const foundUser = await this.#findUserByEmail(user.email);

      if (foundUser === null) {
        this.log.info(`User <${user.email}> not found, needs invite to workspace ${this.team.getId()}`);
        return SLACK_STATUSES.USER_NEEDS_INVITATION_TO_WORKSPACE;
      }

      const userChannels = await this.#getUserChannels(foundUser.getId());

      if (userChannels.length > 0 && foundUser.isSingleChannelGuestUser()) {
        this.log.warn(`User <@${foundUser.getId()}> is already in another channel (Single-Channel Guest), cannot invite to channel ${channelId}`);
        return SLACK_STATUSES.USER_ALREADY_IN_ANOTHER_CHANNEL;
      }

      const userInChannel = userChannels.some((channel) => channel.getId() === channelId);
      if (userInChannel) {
        this.log.warn(`User <@${foundUser.getId()}> is already in channel <#${channelId}>`);
        await this.#postMessageToOpsChannel(`User <@${foundUser.getId()}> [${foundUser.getEmail()} / ${foundUser.getId()}] is already in channel <#${channelId}>`);
        return SLACK_STATUSES.USER_ALREADY_IN_CHANNEL;
      }

      await this.#inviteUserToChannel(foundUser.getId(), channelId);

      this.log.info(`Invited user ${foundUser.getId()} to channel ${channelId} in workspace ${this.team.getId()}`);
      await this.#postMessageToOpsChannel(`Invited user <@${foundUser.getId()}> [${foundUser.getEmail()} / ${foundUser.getId()}] to channel <#${channelId}>`);

      this._logDuration(`Invited user ${foundUser.getId()} to channel ${channelId}`, startTime);

      return SLACK_STATUSES.USER_INVITED_TO_CHANNEL;
    } catch (e) {
      this.log.error(`Failed to invite user ${user.email} to channel ${channelId}`, e);
      throw e;
    }
  }

  async createChannel(name, topic, description, isPrivate = true) {
    if (!hasText(name)) {
      throw new Error('Channel name is required');
    }

    await this.#initialize();

    try {
      const response = await this._apiCall('conversations.create', {
        name,
        is_private: isPrivate,
      });

      const channel = SlackChannel.create(response.channel);

      this.log.info(`Created channel ${channel.getId()} with name ${channel.getName()} in workspace ${this.team.getId()}`);
      await this.#postMessageToOpsChannel(`Created channel <#${channel.getId()}> in workspace ${this.team.getName()} (${this.team.getId()})`);

      await this.#addAdminsToChannel(channel.getId());

      if (hasText(topic)) {
        await this._apiCall('conversations.setTopic', {
          channel: channel.getId(),
          topic,
        });
      }

      if (hasText(description)) {
        await this._apiCall('conversations.setPurpose', {
          channel: channel.getId(),
          purpose: description,
        });
      }

      return channel;
    } catch (e) {
      const code = e.data?.error;
      if (code === 'name_taken') {
        this.log.warn(`Channel with name ${name} already exists`);
        await this.#postMessageToOpsChannel(`Channel #${name} already exists`);
        throw createErrorWithCode(`Channel with name ${name} already exists`, SLACK_STATUSES.CHANNEL_ALREADY_EXISTS);
      } else {
        this.log.error(`Failed to create channel ${name}`, e);
        throw e;
      }
    }
  }

  async inviteUsersByEmail(channelId, users) {
    if (!hasText(channelId)) {
      throw new Error('Channel ID is required');
    }

    if (!Array.isArray(users)) {
      throw new Error('Users must be an array');
    }

    const validUsers = users.filter((user) => hasText(user.email));

    if (validUsers.length < 1) {
      throw new Error('At least one valid user is required');
    }

    await this.#initialize();

    this.log.info(`Inviting ${validUsers.length} users to channel ${channelId} in workspace ${this.team.getId()}`);

    // Bulk handle user invites and capture results
    return this.#handleUserInvites(channelId, validUsers);
  }
}
