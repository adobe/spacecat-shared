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

/**
 * Represents a single row in the `brand_presence_executions` ClickHouse table.
 *
 * Table engine: MergeTree()
 * Partition by: (platform, toYYYYMM(execution_date))
 * Order by:     (platform, execution_date, category, topic)
 */
export interface BrandPresenceExecution {
  platform: string;

  week: string;

  execution_date: Date;

  category: string;

  topic: string;

  prompt: string;

  origin: 'HUMAN' | 'AI';

  region: string;

  volume: number;

  user_intent: 'informational' | 'commercial' | 'transactional';

  answer: string;

  sources: string[];

  citations: boolean;

  mentions: boolean;

  sentiment: 'positive' | 'neutral' | 'negative';

  business_competitors: string[];

  is_answered: boolean;

  position: number;

  visibility_score: number;

  detected_brand_mentions: string | null;

  error_code: string | null;

  citation_sample_size: number;

  citation_answers_with_citations: number;

  citation_potential: string;
  
  updated_at: Date;
}
