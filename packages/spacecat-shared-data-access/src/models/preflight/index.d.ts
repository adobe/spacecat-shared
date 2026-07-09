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

import type { AsyncJob, BaseCollection, BaseModel, Site } from '../index.js';

// SITES-47254: startedAt/result/error live on AsyncJob — fetch via getAsyncJob().
export interface Preflight extends BaseModel {
    getSiteId(): string;
    getSite(): Promise<Site>;
    getAsyncJobId(): string;
    getAsyncJob(): Promise<AsyncJob>;
    getUrl(): string;
    getStatus(): string;
    getCreatedBy(): { email: string; displayName?: string };
    // `string | undefined` (not `| null`) because normalizeModelValue maps
    // DB NULL → undefined on read — see AsyncJob/index.d.ts header.
    getEndedAt(): string | undefined;

    setUrl(url: string): Preflight;
    setStatus(status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED'): Preflight;
    setCreatedBy(createdBy: { email: string; displayName?: string }): Preflight;
    setEndedAt(endedAt: string): Preflight;
}

export interface PreflightCollection extends BaseCollection<Preflight> {
    allBySiteId(siteId: string): Promise<Preflight[]>;
    findBySiteId(siteId: string): Promise<Preflight | null>;
    findByAsyncJobId(asyncJobId: string): Promise<Preflight | null>;
    allBySiteIdAndUrl(siteId: string, url?: string): Promise<Preflight[]>;
}
