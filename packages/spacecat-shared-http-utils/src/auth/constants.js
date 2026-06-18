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

export const FF_READ_ONLY_ORG = 'FT_LLMO-3008';

/**
 * FACS feature-flag table per product code (from `x-product` header, uppercased).
 *
 * Product is mapped to its LaunchDarkly key. Products absent from this map
 * are treated as "flag retired — enforcement is universal for this product"
 * and the wrapper proceeds past the rollout gate (see facsWrapper §"Flag
 * retirement" — removing an entry here, paired with the LD key removal, is
 * the documented retirement mechanism).
 *
 * The constant name uses the `FT_` prefix to match the LaunchDarkly key
 * naming convention. The values are the current LD keys (LLMO ships under
 * `FF_LLMO-3026`; ASO under `FT_SITES-44631`); shared here so the same
 * source of truth is consumed by both `spacecat-auth-service` (login-time
 * lookup) and `facsWrapper` (request-time enforcement gate).
 */
export const FT_MAC_FACS_PERMISSIONS = {
  LLMO: 'FF_LLMO-3026',
  ASO: 'FT_SITES-44631',
};

export const X_PRODUCT_HEADER = 'x-product';
