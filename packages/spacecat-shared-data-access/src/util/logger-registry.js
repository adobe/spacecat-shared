/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

class LoggerRegistry {
  static #instance = null;

  #logger = null;

  static getInstance() {
    if (!LoggerRegistry.#instance) {
      LoggerRegistry.#instance = new LoggerRegistry();
    }
    return LoggerRegistry.#instance;
  }

  setLogger(logger) {
    this.#logger = logger;
  }

  getLogger() {
    return this.#logger || console;
  }
}

/**
 * Registers a logger instance for global access.
 * This should be called during data access initialization.
 * @param {Object} logger - Logger instance
 */
export function registerLogger(logger) {
  LoggerRegistry.getInstance().setLogger(logger);
}

/**
 * Gets the currently registered logger instance.
 * Falls back to console if no logger is registered.
 * @returns {Object} Logger instance
 */
export function getLogger() {
  return LoggerRegistry.getInstance().getLogger();
}
