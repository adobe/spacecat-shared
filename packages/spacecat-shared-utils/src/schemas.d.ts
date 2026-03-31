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

import type * as z from 'zod';

// NOTE: This file declares types directly rather than re-exporting from ./index.js
// because index.d.ts exposes schemas as a namespace (export * as schemas), not as
// flat named exports. The ZodEffects<ZodObject<any>> type is lossy — it erases the
// specific schema shape, so consumers get no field-level autocomplete or type errors.
// See "Unify .d.ts declaration strategy" in the design spec's Future Improvements.
export declare const llmoConfig: z.ZodEffects<z.ZodObject<any>>;
export type LLMOConfig = z.output<typeof llmoConfig>;
