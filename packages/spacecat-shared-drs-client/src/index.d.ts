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
  s3Bucket?: string;
  snsTopicArn?: string;
  awsRegion?: string;
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

interface PublishBrandPresenceParams {
  resultLocation: string;
  webSearchProvider?: string;
  configVersion?: string;
  week?: number;
  year?: number;
  runFrequency?: 'daily' | 'weekly';
  brand?: string;
  imsOrgId?: string;
}

interface BrandDetectionOptions {
  batchId?: string;
  priority?: string;
}

type ExperimentPhase = 'pre' | 'post';

interface CreateExperimentScheduleParams {
  siteId: string;
  experimentId: string;
  experimentPhase: ExperimentPhase;
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
  isS3Configured(): boolean;
  uploadExcelToDrs(siteId: string, jobId: string, excelBuffer: Buffer | Uint8Array): Promise<string>;
  publishBrandPresenceAnalyze(siteId: string, params: PublishBrandPresenceParams): Promise<string>;
  submitJob(params: Record<string, unknown>): Promise<DrsJobResult>;
  submitPromptGenerationJob(params: PromptGenerationParams): Promise<DrsJobResult>;
  submitScrapeJob(params: ScrapeJobParams): Promise<DrsJobResult>;
  lookupScrapeResults(params: ScrapeLookupParams): Promise<ScrapeLookupResponse | null>;
  triggerBrandDetection(siteId: string, options?: BrandDetectionOptions): Promise<Record<string, unknown> | null>;
  createExperimentSchedule(params: CreateExperimentScheduleParams): Promise<ScheduleStatusResult>;
  getScheduleStatus(siteId: string, scheduleId: string): Promise<ScheduleStatusResult>;
  getJob(jobId: string): Promise<Record<string, unknown>>;
}

export declare const SCRAPE_DATASET_IDS: Readonly<{
  YOUTUBE_VIDEOS: 'youtube_videos';
  YOUTUBE_COMMENTS: 'youtube_comments';
  REDDIT_POSTS: 'reddit_posts';
  REDDIT_COMMENTS: 'reddit_comments';
  WIKIPEDIA: 'wikipedia';
}>;

export default DrsClient;
