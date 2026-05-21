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
 * BrandSemrushProject - mapping between an Adobe brand and a Semrush AIO
 * project. One row per (brand, semrushLocationId, language) slice. The Semrush
 * workspace is reachable via brand -> organization.getSemrushWorkspaceId() and
 * is not duplicated on this entity.
 *
 * @class BrandSemrushProject
 * @extends BaseModel
 */
class BrandSemrushProject extends BaseModel {
  static ENTITY_NAME = 'BrandSemrushProject';
}

export default BrandSemrushProject;
