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

import { z } from "zod";

export const DetectMessage = z.object({
  auditId: z.uuid(),
  baseURL: z.httpUrl(),
  calendarWeek: z.object({
    date: z.iso.date().optional(),
    week: z.number(),
    year: z.number(),
  }),
  configVersion: z.string().nullable(),
  date: z.iso.date().optional(),
  deliveryType: z.string(),
  siteId: z.uuid(),
  type: z.literal("detect:geo-brand-presence").or(z.literal("detect:geo-brand-presence-daily")),
  url: z.httpUrl(),
  webSearchProvider: z.union([
    z.literal('ai_mode'),
    z.literal('all'),
    z.literal('chatgpt'),
    z.literal('copilot'),
    z.literal('gemini'),
    z.literal('google_ai_overviews'),
    z.literal('perplexity'),
  ]),
});
