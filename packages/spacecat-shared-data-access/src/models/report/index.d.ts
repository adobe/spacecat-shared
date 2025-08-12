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

import type { BaseModel, BaseCollection, Site } from '../index';

export interface Report extends BaseModel {
  getReportType(): string;
  getReportPeriod(): { startDate: string; endDate: string };
  getComparisonPeriod(): { startDate: string; endDate: string };
  getStoragePath(): string;
  getRawStoragePath(): string;
  getEnhancedReportPath(): string;
  getSite(): Promise<Site>;
  setReportType(reportType: string): Report;
  setReportPeriod(period: { startDate: string; endDate: string }): Report;
  setComparisonPeriod(period: { startDate: string; endDate: string }): Report;
  setStoragePath(path: string): Report;
}

export interface ReportCollection extends BaseCollection<Report> {
  // Add collection-specific methods here if needed
  allBySiteId(siteId: string): Promise<Report[]>;
  findBySiteId(siteId: string): Promise<Report | null>;
  allByReportType(reportType: string): Promise<Report[]>;
  findByReportType(reportType: string): Promise<Report | null>;
}
