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
 * Represents a Slack channel
 */
export default class SlackChannel {
  /**
   * Creates a new Slack channel
   *
   * @param {object} channelData - channel data
   * @param {string} channelData.id - channel id
   * @param {string} channelData.name - channel name
   * @param {boolean} channelData.is_private - is channel private
   * @param {boolean} channelData.is_archived - is channel archived
   * @constructor
   */
  constructor(channelData) {
    this.id = channelData.id;
    this.name = channelData.name;
    this.is_private = channelData.is_private;
    this.is_archived = channelData.is_archived;
  }

  static create(channelData) {
    return new SlackChannel(channelData);
  }

  getId() {
    return this.id;
  }

  getName() {
    return this.name;
  }

  isPublic() {
    return !this.is_private;
  }

  isArchived() {
    return this.is_archived;
  }
}
