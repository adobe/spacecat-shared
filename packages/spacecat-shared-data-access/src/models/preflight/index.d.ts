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

export interface Preflight extends BaseModel {
    getSiteId(): string;
    getSite(): Promise<Site>;
    getAsyncJobId(): string;
    getAsyncJob(): Promise<AsyncJob>;
    getUrl(): string;
    getStatus(): string;
    getCreatedBy(): { email: string; displayName?: string };
    getStartedAt(): string | null;
    getEndedAt(): string | null;
    getResult(): object | null;
    getError(): { code: string; message: string } | null;

    setUrl(url: string): Preflight;
    setStatus(status: string): Preflight;
    setCreatedBy(createdBy: { email: string; displayName?: string }): Preflight;
    setStartedAt(startedAt: string): Preflight;
    setEndedAt(endedAt: string): Preflight;
    setResult(result: object): Preflight;
    setError(error: { code: string; message: string }): Preflight;
}

export interface PreflightCollection extends BaseCollection<Preflight> {
    allBySiteId(siteId: string): Promise<Preflight[]>;
    findBySiteId(siteId: string): Promise<Preflight | null>;
    findByAsyncJobId(asyncJobId: string): Promise<Preflight | null>;
    allBySiteIdAndUrl(siteId: string, url?: string): Promise<Preflight[]>;
}
