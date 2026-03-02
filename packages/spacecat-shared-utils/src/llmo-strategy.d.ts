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

import { S3Client } from '@aws-sdk/client-s3';

/**
 * Returns the S3 path for the strategy file.
 * @param siteId - The ID of the site.
 * @returns The strategy file path.
 */
export function strategyPath(siteId: string): string;

export interface ReadStrategyOptions {
  /**
   * Optional version ID of the strategy to read.
   * Defaults to the latest version.
   */
  version?: string;
  /**
   * Optional S3 bucket name.
   */
  s3Bucket?: string;
}

export interface ReadStrategyResult {
  /**
   * The strategy data, or null if it doesn't exist.
   */
  data: object | null;
  /**
   * Whether the strategy exists.
   */
  exists: boolean;
  /**
   * The version ID of the strategy, if it exists.
   */
  version?: string;
}

/**
 * Reads the strategy JSON for a given site.
 * Returns null if the strategy does not exist.
 *
 * @param siteId - The ID of the site.
 * @param s3Client - The S3 client to use for reading the strategy.
 * @param options - Optional configuration.
 * @returns The strategy data, existence flag, and version ID.
 * @throws Error if reading the strategy fails for reasons other than it not existing.
 */
export function readStrategy(
  siteId: string,
  s3Client: S3Client,
  options?: ReadStrategyOptions
): Promise<ReadStrategyResult>;

export interface WriteStrategyOptions {
  /**
   * Optional S3 bucket name.
   */
  s3Bucket?: string;
}

export interface WriteStrategyResult {
  /**
   * The version ID of the written strategy.
   */
  version: string;
}

/**
 * Writes the strategy JSON for a given site.
 *
 * @param siteId - The ID of the site.
 * @param data - The data object to write (any valid JSON).
 * @param s3Client - The S3 client to use for writing the strategy.
 * @param options - Optional configuration.
 * @returns The version of the strategy written.
 */
export function writeStrategy(
  siteId: string,
  data: object,
  s3Client: S3Client,
  options?: WriteStrategyOptions
): Promise<WriteStrategyResult>;
