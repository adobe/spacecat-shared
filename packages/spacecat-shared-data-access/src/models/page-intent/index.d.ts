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

import type { BaseCollection, BaseModel, Site } from '../index.js';

export interface PageIntent extends BaseModel {
    getSiteId(): string;
    getSite(): Promise<Site>;
    getUrl(): string;
    getPageIntent(): string;
    getTopic(): string;
    getAnalysisStatus(): string | null;
    getAnalysisAttempts(): number | null;
    getLastAnalysisAt(): string | null;
    getAnalysisError(): { code: string; message: string; details?: any } | null;

    setSiteId(siteId: string): PageIntent;
    setUrl(url: string): PageIntent;
    setPageIntent(pageIntent: string): PageIntent;
    setTopic(topic: string): PageIntent;
    setAnalysisStatus(status: string): PageIntent;
    setAnalysisAttempts(attempts: number): PageIntent;
    setLastAnalysisAt(timestamp: string): PageIntent;
    setAnalysisError(error: { code: string; message: string; details?: any }): PageIntent;
}

export interface PageIntentCollection extends BaseCollection<PageIntent> {
    allBySiteId(siteId: string): Promise<PageIntent[]>;
    findBySiteId(siteId: string): Promise<PageIntent | null>;
    allByUrl(url: string): Promise<PageIntent[]>;
    findByUrl(url: string): Promise<PageIntent | null>;
}
