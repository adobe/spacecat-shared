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

import BaseModel from '../base/base.model.js';

/**
 * ScrapeJob - A class representing an ScrapeJob entity.
 * Provides methods to access and manipulate ScrapeJob-specific data.
 *
 * @class ScrapeJob
 * @extends BaseModel
 */
class ScrapeJob extends BaseModel {
  static ENTITY_NAME = 'ScrapeJob';

  static SCRAPE_JOB_EXPIRES_IN_DAYS = 120;

  /**
   * Scrape Job Status types.
   * Any changes to this object needs to be reflected in the index.d.ts file as well.
   */
  static ScrapeJobStatus = {
    RUNNING: 'RUNNING',
    COMPLETE: 'COMPLETE',
    FAILED: 'FAILED',
    STOPPED: 'STOPPED',
  };

  /**
   * ScrapeURL Status types.
   * Any changes to this object needs to be reflected in the index.d.ts file as well.
   */
  static ScrapeUrlStatus = {
    PENDING: 'PENDING',
    REDIRECT: 'REDIRECT',
    ...ScrapeJob.ScrapeJobStatus,
  };

  /**
   * Supported Scrape Options.
   */
  static ScrapeOptions = {
    ENABLE_JAVASCRIPT: 'enableJavascript',
    HIDE_CONSENT_BANNER: 'hideConsentBanners',
    PAGE_LOAD_TIMEOUT: 'pageLoadTimeout',
    WAIT_FOR_SELECTOR: 'waitForSelector',
    SECTION_LOAD_WAIT_TIME: 'sectionLoadWaitTime',
    SCREENSHOT_TYPES: 'screenshotTypes',
  };

  static ScrapeProcessingType = {
    DEFAULT: 'default',
    ACCESSIBILITY: 'accessibility',
    FORM_ACCESSIBILITY: 'form-accessibility',
    FORM: 'form',
    TEXT_CONTENT: 'text-content',
  };

  static ScrapeScreenshotType = {
    FULL_PAGE: 'fullPage',
    THUMBNAIL: 'thumbnail',
    SECTION: 'section',
    BLOCK: 'block',
    SCROLL: 'scroll',
  };

  // add your custom methods or overrides here
}

export default ScrapeJob;
