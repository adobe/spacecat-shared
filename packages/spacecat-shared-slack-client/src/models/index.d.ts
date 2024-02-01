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
// eslint-disable-next-line max-classes-per-file
export class SlackChannel {
  /**
   * Retrieves the unique identifier of the channel.
   * @returns {string} The channel's ID.
   */
  getId(): string;

  /**
   * Retrieves the name of the channel.
   * @returns {string} The channel's name.
   */
  getName(): string;
}

export class SlackTeam {
  /**
   * Retrieves the unique identifier of the team.
   * @returns {string} The team's ID.
   */
  getId(): string;

  /**
   * Retrieves the name of the team.
   * @returns {string} The team's name.
   */
  getName(): string;
}

/**
 * Represents a Slack user with detailed information. Provides methods to access
 * user data such as ID, team ID, name, real name, email, and user roles/status.
 */
export class SlackUser {
  /**
   * Retrieves the unique identifier of the user.
   * @returns The user's ID.
   */
  getId(): string;

  /**
   * Retrieves the email address of the user.
   * @returns The email address of the user.
   */
  getEmail(): string;

  /**
   * Determines if the user is a single-channel guest in the workspace.
   * @returns True if the user is a single-channel guest, false otherwise.
   */
  isSingleChannelGuestUser(): boolean;
}
