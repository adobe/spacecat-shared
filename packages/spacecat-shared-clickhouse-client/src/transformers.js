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

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  const parts = (value ?? '').split(';');
  return parts.map((s) => s.trim()).filter(Boolean);
}

// erstellt mit claude code - Model: Sonnet 4.6 - Prompt: "please transform the following json
// object to a BrandPresenceExecution object according to the interface in the
// brand-presence-execution.d.ts file" + json Datei im Anhang
export function toBrandPresenceExecution(raw) {
  return {
    site_id: raw.site_id,
    platform: raw.platform,
    week: raw.week,
    execution_date: raw.execution_date,
    category: raw.category,
    topic: raw.topic,
    prompt: raw.prompt,
    origin: raw.origin,
    region: raw.region?.toLowerCase(),
    volume: parseInt(raw.volume, 10),
    user_intent: raw.user_intent,
    answer: raw.answer,
    sources: toArray(raw.sources),
    citations: Boolean(raw.citations),
    answer_contains_brandname: Boolean(raw.answer_contains_brandname),
    sentiment: raw.sentiment,
    business_competitors: toArray(raw.business_competitors),
    is_answered: Boolean(raw.is_answered),
    position: parseInt(raw.position, 10) || 0,
    visibility_score: parseInt(raw.visibility_score, 10) || 0,
    detected_brand_mentions: raw.detected_brand_mentions ?? null,
    error_code: raw.error_code ?? null,
    citation_sample_size: raw.citation_sample_size,
    citation_answers_with_citations: raw.citation_answers_with_citations,
    citation_potential: raw.citation_potential,
    updated_at: (raw.updated_at ?? new Date().toISOString()).replace('T', ' ').replace(/\.\d+Z$/, ''),
    // Claude Code, Model: Sonnet 4.6 - Prompt: "fix ISO timestamp to a valid clickhouse timestamp"
  };
}

export function toBrandPresenceCompetitorData(raw) {
  return toArray(raw.business_competitors).map((competitor) => ({
    site_id: raw.site_id,
    platform: raw.platform,
    week: raw.week,
    category: raw.category,
    competitor,
    region: raw.region?.toLowerCase(),
  }));
}
