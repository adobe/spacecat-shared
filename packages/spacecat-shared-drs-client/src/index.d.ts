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

import { UniversalContext } from '@adobe/helix-universal';

export type DatasetId = 'youtube_videos' | 'youtube_comments' | 'reddit_posts' | 'reddit_comments' | 'wikipedia';

export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export declare const VALID_DATASET_IDS: readonly DatasetId[];

export declare const JOB_STATUSES: {
  readonly QUEUED: 'QUEUED';
  readonly RUNNING: 'RUNNING';
  readonly COMPLETED: 'COMPLETED';
  readonly FAILED: 'FAILED';
};

export interface JobMetadata {
  imsOrgId: string;
  brand: string;
  site: string;
}

export interface JobRequest {
  datasetId: DatasetId;
  urls: string[];
  metadata: JobMetadata;
}

export interface JobSubmitResponse {
  job_id: string;
  status: JobStatus;
  provider_id: string;
  priority: string;
  submitted_at: number;
}

export interface UrlResult {
  s3_path: string;
  url_hash: string;
  record_count: number;
  success_count: number;
  error_count: number;
  has_errors: boolean;
}

export interface JobResult {
  success_urls: number;
  total_urls: number;
  error_urls: number;
  missing_urls: number;
  total_records: number;
  url_results: Record<string, UrlResult>;
  s3_paths: string[];
}

export interface JobStatusResponse {
  job_id: string;
  provider_id: string;
  priority: string;
  status: JobStatus;
  parameters: {
    dataset_id: DatasetId;
    urls: string[];
  };
  submitted_at: number;
  ims_org_id: string;
  brand: string;
  site: string;
  started_at: number;
  retry_count: number;
  external_job_id: string;
  ttl: number;
  started_by: string;
  trace_id: string;
  result?: JobResult;
  result_url?: string;
  result_url_expires_in?: number;
}

export interface PollOptions {
  pollIntervalMs?: number;
  maxTimeoutMs?: number;
}

export type LookupUrlStatus = 'available' | 'scraping' | 'not_found';

export interface LookupUrlResult {
  url: string;
  status: LookupUrlStatus;
  scraped_at?: string;
  presigned_url?: string;
  expires_in?: number;
  job_id?: string;
  message?: string;
}

export interface LookupUrlsSummary {
  total: number;
  available: number;
  scraping: number;
  not_found: number;
}

export interface LookupUrlsResponse {
  results: LookupUrlResult[];
  summary: LookupUrlsSummary;
}

export default class DrsClient {
  static createFrom(context: UniversalContext): DrsClient;

  constructor(config: { apiBaseUrl: string; apiKey: string }, log?: Console);

  submitJob(request: JobRequest): Promise<JobSubmitResponse>;

  getJobStatus(jobId: string): Promise<JobStatusResponse>;

  pollJobStatus(jobId: string, options?: PollOptions): Promise<JobStatusResponse>;

  lookupUrls(urls: string[]): Promise<LookupUrlsResponse>;
}
