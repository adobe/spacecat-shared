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

/**
 * Static handler for GET /v1/ai_models — the GLOBAL AI-model catalog (not workspace/project
 * scoped) the consumer (spacecat-api-service `listGlobalAiModels`) reads to populate the
 * "available models" list. Added to the spec by overlay CR1. Live shape:
 * `{ page, total, items: [{ id, name, key, icon }] }`. This is the FULL live catalog (the real
 * model keys/ids/icons), captured verbatim 2026-06-25 so the mock returns the same taxonomy the
 * consumer maps `model.key` from. (Live reports `total: 22` while returning these 11 distinct
 * models — a Semrush counting quirk; the mock keeps `total` consistent with the items it serves.)
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

const MODELS = [
  {
    id: 'ee6a9130-3d57-4196-b1a2-43a6edd2d0d6',
    name: 'OpenEvidence',
    key: 'open-evidence',
    icon: 'openEvidence',
  },
  {
    id: 'eab23d14-df70-463f-8779-3f6a4ba770bc',
    name: 'ChatGPT',
    key: 'search-gpt',
    icon: 'openai',
  },
  {
    id: '7e372c8f-d9a8-4255-a049-d4cd60772f20',
    name: 'ChatGPT (No Search)',
    key: 'gpt-5',
    icon: 'openai',
  },
  {
    id: 'a041f7d9-abb7-4b02-9967-b37459ef0d80',
    name: 'Google AI Overview',
    key: 'google-ai-overview',
    icon: 'google',
  },
  {
    id: 'a31bd3b2-deb2-4e22-8191-9c255671835d',
    name: 'Google AI Mode',
    key: 'google-ai-mode',
    icon: 'google',
  },
  {
    id: '4e0afe27-c9cc-4730-9dd1-f307309bafe3',
    name: 'Perplexity',
    key: 'perplexity',
    icon: 'perplexity',
  },
  {
    id: '56423570-b83d-4dc9-a743-52f8521c986c',
    name: 'MS Copilot',
    key: 'microsoft-copilot',
    icon: 'microsoftCopilot',
  },
  {
    id: 'b549432a-bb68-40d0-9901-6aeab4e975a2',
    name: 'Grok',
    key: 'grok-3',
    icon: 'grok',
  },
  {
    id: '58c396de-85a4-4f7f-adfb-240019c6375f',
    name: 'Gemini',
    key: 'gemini-2.5-flash',
    icon: 'gemini',
  },
  {
    id: '8663d87f-f2cc-43e6-851e-c5fc38527c9c',
    name: 'Claude',
    key: 'claude-sonnet-4',
    icon: 'claude',
  },
  {
    id: '452163e0-dcd6-4f48-9610-192848e52694',
    name: 'Deepseek',
    key: 'deepseek',
    icon: 'deepseek',
  },
];

/** GET — list the global AI model catalog. */
export function GET($) {
  return $.response[200].json({ page: 1, total: MODELS.length, items: MODELS });
}
