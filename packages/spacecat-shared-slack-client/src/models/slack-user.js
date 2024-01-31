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
 * Represents a Slack user
 */
export default class SlackUser {
  /**
   * Creates a new Slack user
   *
   * @param {object} userData - user data
   * @param {string} userData.id - user id
   * @param {string} userData.team_id - team id
   * @param {string} userData.name - user name
   * @param {object} userData.profile - user profile
   * @param {string} userData.profile.real_name - user real name
   * @param {string} userData.profile.email - user email
   * @param {boolean} userData.is_admin - is user admin
   * @param {boolean} userData.is_owner - is user owner
   * @param {boolean} userData.is_bot - is user bot
   * @param {boolean} userData.is_restricted - is user restricted
   * @param {boolean} userData.is_ultra_restricted - is user ultra restricted
   * @constructor
   *
   */
  constructor(userData) {
    this.id = userData.id;
    this.teamId = userData.team_id;
    this.name = userData.name;
    this.realName = userData.profile?.real_name;
    this.email = userData.profile?.email;
    this.isAdmin = userData.is_admin;
    this.isOwner = userData.is_owner;
    this.isBot = userData.is_bot;
    this.isRestricted = userData.is_restricted;
    this.isUltraRestricted = userData.is_ultra_restricted;
  }

  static create(userData) {
    return new SlackUser(userData);
  }

  getId() {
    return this.id;
  }

  getTeamId() {
    return this.teamId;
  }

  getHandle() {
    return this.name;
  }

  getRealName() {
    return this.realName;
  }

  getEmail() {
    return this.email;
  }

  isAdminUser() {
    return this.isAdmin;
  }

  isOwnerUser() {
    return this.isOwner;
  }

  isBotUser() {
    return this.isBot;
  }

  isMultiChannelGuestUser() {
    return this.isRestricted && !this.isUltraRestricted;
  }

  isSingleChannelGuestUser() {
    return this.isRestricted && this.isUltraRestricted;
  }
}
