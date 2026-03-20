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

interface DrsClientConfig {
  apiBaseUrl: string;
  apiKey: string;
}

interface PromptGenerationParams {
  baseUrl: string;
  brandName: string;
  audience: string;
  region?: string;
  numPrompts?: number;
  source?: string;
  siteId: string;
  imsOrgId: string;
}

export type ScrapeDatasetId = typeof SCRAPE_DATASET_IDS[keyof typeof SCRAPE_DATASET_IDS];

interface ScrapeJobParams {
  datasetId: ScrapeDatasetId;
  siteId: string;
  urls: string[];
  priority?: 'HIGH' | 'LOW';
  daysBack?: number;
}

interface ScrapeLookupParams {
  datasetId: ScrapeDatasetId;
  siteId: string;
  urls: string[];
}

export type ScrapeLookupStatus = 'available' | 'scraping' | 'not_found';

export interface ScrapeLookupResult {
  url: string;
  status: ScrapeLookupStatus;
  scraped_at?: string;
  presigned_url?: string;
  expires_in?: number;
  job_id?: string;
  message?: string;
}

export interface ScrapeLookupSummary {
  total: number;
  available: number;
  scraping: number;
  not_found: number;
}

export interface ScrapeLookupResponse {
  results: ScrapeLookupResult[];
  summary: ScrapeLookupSummary;
}

interface BrandDetectionOptions {
  batchId?: string;
  priority?: string;
}

type ExperimentPhase = 'pre' | 'post';

interface SubmitExperimentParams {
  siteId: string;
  experimentId: string;
  experimentPhase: ExperimentPhase;
  experimentationUrls?: string[];
  platforms?: string[];
  intervalMinutes?: number;
  durationHours?: number;
  metadata?: Record<string, unknown>;
}

interface ExperimentPhaseStatus {
  phase: ExperimentPhase;
  status: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
    cancelled: number;
  };
  progress_percent: number;
  platforms?: Record<string, { total: number; completed: number; failed: number; running: number }>;
  started_at?: number;
  completed_at?: number;
  experiment_hour?: number;
}

interface ExperimentSubmitResult {
  schedule_id: string;
  experiment_id: string;
  experiment_phase: ExperimentPhase;
  experiment_batch_id: string;
  parent_batch_id: string;
  site_id: string;
  jobs_submitted: number;
  jobs_failed: number;
  [key: string]: unknown;
}

interface ExperimentStatusResult {
  experiment_id: string;
  status: string;
  site_id?: string;
  phases: {
    pre?: ExperimentPhaseStatus;
    post?: ExperimentPhaseStatus;
  };
  summary: {
    total_jobs: number;
    pre_jobs: number;
    post_jobs: number;
    phases_started: number;
    phases_completed: number;
  };
}

interface CreateExperimentScheduleParams {
  siteId: string;
  experimentId: string;
  experimentPhase: ExperimentPhase;
  experimentationUrls?: string[];
  platforms?: string[];
  metadata?: Record<string, unknown>;
  triggerImmediately?: boolean;
}

interface ScheduleJobsSummary {
  total: number;
  completed: number;
  completed_with_errors: number;
  failed: number;
  cancelled: number;
  in_progress: number;
  is_complete: boolean;
  status_breakdown: Record<string, number>;
}

interface ScheduleStatusResult {
  schedule: {
    site_id: string;
    schedule_id: string;
    enabled?: string;
    [key: string]: unknown;
  };
  jobs_summary?: ScheduleJobsSummary;
  [key: string]: unknown;
}

interface DrsJobResult {
  job_id: string;
  [key: string]: unknown;
}

declare class DrsClient {
  static createFrom(context: { env: Record<string, string>; log?: Console }): DrsClient;
  constructor(config: DrsClientConfig, log?: Console);
  isConfigured(): boolean;
  submitJob(params: Record<string, unknown>): Promise<DrsJobResult>;
  submitPromptGenerationJob(params: PromptGenerationParams): Promise<DrsJobResult>;
  submitScrapeJob(params: ScrapeJobParams): Promise<DrsJobResult>;
  lookupScrapeResults(params: ScrapeLookupParams): Promise<ScrapeLookupResponse | null>;
  triggerBrandDetection(siteId: string, options?: BrandDetectionOptions): Promise<Record<string, unknown> | null>;
  submitExperiment(params: SubmitExperimentParams): Promise<ExperimentSubmitResult>;
  getExperimentStatus(experimentId: string, phase?: ExperimentPhase): Promise<ExperimentStatusResult>;
  createExperimentSchedule(params: CreateExperimentScheduleParams): Promise<ScheduleStatusResult>;
  getScheduleStatus(siteId: string, scheduleId: string): Promise<ScheduleStatusResult>;
  getJob(jobId: string): Promise<Record<string, unknown>>;
}

export declare const EXPERIMENT_PHASES: Readonly<{
  PRE: 'pre';
  POST: 'post';
}>;

export declare const SCRAPE_DATASET_IDS: Readonly<{
  YOUTUBE_VIDEOS: 'youtube_videos';
  YOUTUBE_COMMENTS: 'youtube_comments';
  REDDIT_POSTS: 'reddit_posts';
  REDDIT_COMMENTS: 'reddit_comments';
  WIKIPEDIA: 'wikipedia';
}>;

export default DrsClient;
