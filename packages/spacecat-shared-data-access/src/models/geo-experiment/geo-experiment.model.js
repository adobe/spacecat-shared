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

class GeoExperiment extends BaseModel {
  static ENTITY_NAME = 'GeoExperiment';

  static DEFAULT_UPDATED_BY = 'spacecat';

  static TYPES = {
    ONSITE_OPPORTUNITY_DEPLOYMENT: 'onsite_opportunity_deployment',
  };

  static STATUSES = {
    GENERATING_BASELINE: 'GENERATING_BASELINE',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  };

  static PHASES = {
    PRE_ANALYSIS_SUBMITTED: 'pre_analysis_submitted',
    PRE_ANALYSIS_DONE: 'pre_analysis_done',
    DEPLOYMENT_STARTED: 'deployment_started',
    DEPLOYMENT_COMPLETED: 'deployment_completed',
    POST_ANALYSIS_SUBMITTED: 'post_analysis_submitted',
    POST_ANALYSIS_DONE: 'post_analysis_done',
    FAILED: 'failed',
  };
}

export default GeoExperiment;
