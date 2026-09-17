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

import BaseModel from '../base/base.model.js';

/**
 * OaeValidation - A class representing a single suggestion's validation check within a job.
 * A jobId groups the suggestions submitted together in one validation request; each row
 * tracks one suggestion's check status and outcome within that job.
 *
 * @class OaeValidation
 * @extends BaseModel
 */
class OaeValidation extends BaseModel {
  static ENTITY_NAME = 'OaeValidation';

  /**
   * Processing lifecycle for a row: has the check for this suggestion finished running yet,
   * and did the pipeline itself complete without error. Distinct from Outcome, which records
   * what the check found once the row is COMPLETE.
   */
  static Status = {
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETE: 'COMPLETE',
    FAILED: 'FAILED',
  };

  /**
   * The validation result once a row is COMPLETE. Deliberately not 'true'/'false' -- those
   * read like stringified booleans when they aren't, which is exactly the ambiguity that
   * caused this enum to be renamed from TRUE/FALSE to PASS/FAIL.
   */
  static Outcome = {
    PASS: 'pass',
    FAIL: 'fail',
    UNKNOWN: 'unknown',
  };

  // Add custom methods or overrides here if needed
}

export default OaeValidation;
