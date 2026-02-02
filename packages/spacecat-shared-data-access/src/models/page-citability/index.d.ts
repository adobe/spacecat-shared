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

export interface PageCitability extends BaseModel {
    getSiteId(): string;
    getSite(): Promise<Site>;
    getUrl(): string;
    getCitabilityScore(): number | undefined;
    getContentRatio(): number | undefined;
    getWordDifference(): number | undefined;
    getBotWords(): number | undefined;
    getNormalWords(): number | undefined;
    getIsDeployedAtEdge(): boolean | undefined;

    setSiteId(siteId: string): PageCitability;
    setUrl(url: string): PageCitability;
    setCitabilityScore(citabilityScore?: number): PageCitability;
    setContentRatio(contentRatio?: number): PageCitability;
    setWordDifference(wordDifference?: number): PageCitability;
    setBotWords(botWords?: number): PageCitability;
    setNormalWords(normalWords?: number): PageCitability;
    setIsDeployedAtEdge(isDeployedAtEdge?: boolean): PageCitability;
}

export interface PageCitabilityCollection extends BaseCollection<PageCitability> {
    allBySiteId(siteId: string): Promise<PageCitability[]>;
    findBySiteId(siteId: string): Promise<PageCitability | null>;
    allByUrl(url: string): Promise<PageCitability[]>;
    findByUrl(url: string): Promise<PageCitability | null>;
}
