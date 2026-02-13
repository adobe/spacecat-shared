/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import PostgresBaseModel from '../base/postgres-base.model.js';

class PostgresScrapeJobModel extends PostgresBaseModel {
  static ENTITY_NAME = 'ScrapeJob';

  static SCRAPE_JOB_EXPIRES_IN_DAYS = 120;

  static ScrapeJobStatus = {
    RUNNING: 'RUNNING',
    COMPLETE: 'COMPLETE',
    FAILED: 'FAILED',
    STOPPED: 'STOPPED',
  };

  static ScrapeUrlStatus = {
    PENDING: 'PENDING',
    REDIRECT: 'REDIRECT',
    ...PostgresScrapeJobModel.ScrapeJobStatus,
  };

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
}

export default PostgresScrapeJobModel;
