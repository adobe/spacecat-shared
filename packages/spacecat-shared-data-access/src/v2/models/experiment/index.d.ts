/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { BaseCollection, BaseModel, Site } from '../index';

export interface Experiment extends BaseModel {
  getConversionEventName(): string;
  getConversionEventValue(): string;
  getEndDate(): number;
  getExpId(): string;
  getName(): string;
  getSite(): Promise<Site>;
  getSiteId(): string;
  getStartDate(): number;
  getStatus(): string;
  getType(): string;
  getUrl(): string;
  getVariants(): object;
  setConversionEventName(conversionEventName: string): Experiment;
  setConversionEventValue(conversionEventValue: string): Experiment;
  setEndDate(endDate: number): Experiment;
  setExpId(expId: string): Experiment;
  setName(name: string): Experiment;
  setStartDate(startDate: number): Experiment;
  setStatus(status: string): Experiment;
  setType(type: string): Experiment;
  setUrl(url: string): Experiment;
  setVariants(variants: object): Experiment;
}

export interface ExperimentCollection extends BaseCollection<Experiment> {
  allBySiteId(siteId: string): Promise<Experiment[]>;
  allBySiteIdAndExpId(siteId: string, expId: string): Promise<Experiment[]>;
  findBySiteIdAndExpId(siteId: string, expId: string): Promise<Experiment | null>;
  findBySiteIdAndExpIdAndUrl(
    siteId: string,
    expId: string,
    url: string,
  ): Promise<Experiment | null>;
}