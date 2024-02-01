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

/**
 * Represents a Slack channel with detailed information. Provides methods to access
 * channel data such as ID, name, and privacy status.
 */
export interface SlackChannel {

  /**
   * Retrieves the unique identifier of the channel.
   * @returns {string} The channel's ID.
   */
  getId(): string,

  /**
   * Retrieves the name of the channel.
   * @returns {string} The channel's name.
   */
  getName(): string,
}

export interface SlackTeam {
  /**
   * Retrieves the unique identifier of the team.
   * @returns {string} The team's ID.
   */
  getId(): string,

  /**
   * Retrieves the name of the team.
   * @returns {string} The team's name.
   */
  getName(): string,
}

/**
 * Represents a Slack user with detailed information. Provides methods to access
 * user data such as ID, team ID, name, real name, email, and user roles/status.
 */
export interface SlackUser {
  /**
   * Retrieves the unique identifier of the user.
   * @returns The user's ID.
   */
  getId(): string;

  /**
   * Retrieves the team ID to which the user belongs.
   * @returns The team ID of the user.
   */
  getTeamId(): string;

  /**
   * Retrieves the username or handle of the user.
   * @returns The user's handle or username.
   */
  getHandle(): string;

  /**
   * Retrieves the real name of the user.
   * @returns The real name of the user.
   */
  getRealName(): string;

  /**
   * Retrieves the email address of the user.
   * @returns The email address of the user.
   */
  getEmail(): string;

  /**
   * Checks if the user is an admin.
   * @returns True if the user is an admin, false otherwise.
   */
  isAdminUser(): boolean;

  /**
   * Checks if the user is an owner of the workspace.
   * @returns True if the user is an owner, false otherwise.
   */
  isOwnerUser(): boolean;

  /**
   * Checks if the user is a bot.
   * @returns True if the user is a bot, false otherwise.
   */
  isBotUser(): boolean;

  /**
   * Determines if the user is a multichannel guest in the workspace.
   * @returns True if the user is a multichannel guest, false otherwise.
   */
  isMultiChannelGuestUser(): boolean;

  /**
   * Determines if the user is a single-channel guest in the workspace.
   * @returns True if the user is a single-channel guest, false otherwise.
   */
  isSingleChannelGuestUser(): boolean;
}
