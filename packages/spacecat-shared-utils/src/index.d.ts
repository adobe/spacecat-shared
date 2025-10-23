/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { Request, RequestOptions, Response } from '@adobe/fetch';
import type { ISOCalendarWeek } from './calendar-week-helper.js';

/** UTILITY FUNCTIONS */
export function arrayEquals<T>(a: T[], b: T[]): boolean;

export function hasText(str: string): boolean;

export function isBoolean(value: unknown): boolean;

export function isInteger(value: unknown): boolean;

export function isValidDate(value: unknown): boolean;

export function isValidEmail(email: string): boolean;

export function isIsoDate(str: string): boolean;

export function isIsoTimeOffsetsDate(str: string): boolean;

export function isNumber(value: unknown): boolean;

export function isObject(value: unknown): boolean;

export function isArray(value: unknown): boolean;

export function isNonEmptyArray(value: unknown): boolean;

export function isNonEmptyObject(value: unknown): boolean;

export function isString(value: unknown): boolean;

export function toBoolean(value: unknown): boolean;

export function isValidUrl(urlString: string): boolean;

export function isValidHelixPreviewUrl(urlString: string): boolean;

export function isValidUUID(uuid: string): boolean;

export function isValidIMSOrgId(imsOrgId: string): boolean;

export function dateAfterDays(days: number, dateString: string): Date;

export function deepEqual(a: unknown, b: unknown): boolean;

export function sqsWrapper(fn: (message: object, context: object) => Promise<Response>):
  (request: object, context: object) => Promise<Response>;

export function sqsEventAdapter(fn: (message: object, context: object) => Promise<Response>):
  (request: object, context: object) => Promise<Response>;

/**
 * Prepends 'https://' schema to the URL if it's not already present.
 * @param url - The URL to modify.
 * @returns The URL with 'https://' schema prepended.
 */
declare function prependSchema(url: string): string;

/**
 * Strips the port number from the end of the URL.
 * @param url - The URL to modify.
 * @returns The URL with the port removed.
 */
declare function stripPort(url: string): string;

/**
 * Strips the trailing dot from the end of the URL.
 * @param url - The URL to modify.
 * @returns The URL with the trailing dot removed.
 */
declare function stripTrailingDot(url: string): string;

/**
 * Strips the trailing slash from the end of the URL.
 * @param url - The URL to modify.
 * @returns The URL with the trailing slash removed.
 */
declare function stripTrailingSlash(url: string): string;

/**
 * Strips 'www.' from the beginning of the URL if present.
 * @param url - The URL to modify.
 * @returns The URL with 'www.' removed.
 */
declare function stripWWW(url: string): string;

/**
 * Composes a base URL by applying a series of transformations to the given domain.
 * @param domain - The domain to compose the base URL from.
 * @returns The composed base URL.
 */
declare function composeBaseURL(domain: string): string;

/**
 * Composes an audit URL by applying a series of transformations to the given url.
 * @param {string} url - The url to compose the audit URL from.
 * @param {string} [userAgent] - Optional user agent to use in the audit URL.
 * @returns a promise that resolves the composed audit URL.
 */
declare function composeAuditURL(url: string, userAgent?: string): Promise<string>;

/**
 * Resolves the name of the secret based on the function version.
 * @param {Object} opts - The options object, not used in this implementation.
 * @param {Object} ctx - The context object containing the function version.
 * @param {string} defaultPath - The default path for the secret.
 * @returns {string} - The resolved secret name.
 */
declare function resolveSecretsName(opts: object, ctx: object, defaultPath: string): string;

/**
 * Resolves the name of the customer secrets based on the baseURL.
 * @param {string} baseURL - The base URL to resolve the customer secrets name from.
 * @param {Object} ctx - The context object containing the function version.
 * @returns {string} - The resolved secret name.
 */
declare function resolveCustomerSecretsName(baseURL: string, ctx: object): string;

/**
 * Retrieves the RUM domain key for the specified base URL from the customer secrets.
 *
 * @param {string} baseURL - The base URL for which the RUM domain key is to be retrieved.
 * @param {object} ctx - Helix Universal Context. See https://github.com/adobe/helix-universal/blob/main/src/adapter.d.ts#L120
 * @returns {Promise<string>} - A promise that resolves to the RUM domain key.
 * @throws {Error} Throws an error if no domain key is found for the specified base URL.
 */
declare function getRUMDomainKey(baseURL: string, ctx: object): Promise<string>;

/**
 * Generates a CSV file from the provided JSON data.
 *
 * Each key-value pair in the JSON objects
 * corresponds to a column and its value in the CSV. The output is a UTF-8
 * encoded Buffer that represents the CSV file content.
 *
 * @param {Object[]} data - An array of JSON objects to be converted into CSV format.
 * @returns {Buffer} A Buffer containing the CSV formatted data, encoded in UTF-8.
 */
declare function generateCSVFile(data: object[]): Buffer;

/**
 * Replaces placeholders in the prompt content with their corresponding values.
 *
 * @param {string} content - The prompt content with placeholders.
 * @param {Object} placeholders - The placeholders and their values.
 * @returns {string} - The content with placeholders replaced.
 */
declare function replacePlaceholders(content: string, placeholders: object): string;

/**
 * Function to support reading static file
 * and replace placeholder strings with values.
 *
 * @param {Object} placeholders - A JSON object containing values to replace in the prompt content.
 * @param {String} filename - The path of the prompt file.
 * @returns {Promise<string|null>} - A promise that resolves to a string with the prompt content.
 */
declare function getStaticContent(placeholders: object, filename: string):
  Promise<string | null>;

/**
 * Reads the content of a prompt file asynchronously and replaces any placeholders
 * with the corresponding values. Logs the error and returns null in case of an error.
 *
 * @param {Object} placeholders - A JSON object containing values to replace in the prompt content.
 * @param {String} filename - The filename of the prompt file.
 * @param {Object} log - The logger
 * @returns {Promise<string|null>} - A promise that resolves to a string with the prompt content,
 * or null if an error occurs.
 */
declare function getPrompt(placeholders: object, filename: string, log: object):
  Promise<string | null>;

/**
 * Reads the content of a query file asynchronously and replaces any placeholders
 * with the corresponding values. Logs the error and returns null in case of an error.
 *
 * @param {Object} placeholders - A JSON object containing values to replace in the query content.
 * @param {String} filename - The filename of the query file.
 * @param {Object} log - The logger
 * @returns {Promise<string|null>} - A promise that resolves to a string with the query content,
 * or null if an error occurs.
 */
declare function getQuery(placeholders: object, filename: string, log: object):
  Promise<string | null>;

/**
 * Retrieves the high-form-view-low-form-conversion metrics from the provided array of form vitals.
 * @param {Object[]} formVitals - An array of form vitals.
 * @returns {Object[]} - An array of high-form-view-low-form-conversion metrics.
 */
declare function getHighFormViewsLowConversionMetrics(formVitals: object[]):
  object[];

/**
 * Retrieves the high-page-view-low-form-view metrics from the provided array of form vitals.
 * @param {Object[]} formVitals - An array of form vitals.
 * @returns {Object[]} - An array of high-page-view-low-form-view metrics.
 */
declare function getHighPageViewsLowFormViewsMetrics(formVitals: object[]):
  object[];

/**
 * Retrieves the high-page-view-low-form-ctr metrics from the provided array of form vitals.
 * @param {Object[]} formVitals - An array of form vitals.
 * @returns {Object[]} - An array of high-page-view-low-form-ctr metrics.
 */
declare function getHighPageViewsLowFormCtrMetrics(formVitals: object[]):
  object[];

/**
 * Retrieves stored metrics from S3.
 * @param config - Configuration object
 * @param config.siteId - The site ID.
 * @param config.source - The source of the metrics.
 * @param config.metric - The metric name.
 * @param context - Context object
 * @param context.log - Logger
 * @param context.s3 - S3 configuration
 * @param context.s3.s3Client - S3 client
 * @param context.s3.s3Bucket - S3 bucket name
 * @returns {Promise<any|*[]>} - The stored metrics
 */
export function getStoredMetrics(config: object, context: object):
  Promise<Array<object>>;

/**
 * Stores metrics in S3.
 * @param content - The metrics to store
 * @param config - Configuration object
 * @param config.siteId - The site ID
 * @param config.source - The source of the metrics
 * @param config.metric - The metric name
 * @param context - Context object
 * @param context.log - Logger
 * @param context.s3 - S3 configuration
 * @param context.s3.s3Client - S3 client
 * @param context.s3.s3Bucket - S3 bucket name
 * @returns {Promise<string>} - The path where the metrics are stored
 */
export function storeMetrics(content: object, config: object, context: object): Promise<string>;

export function s3Wrapper(fn: (request: object, context: object) => Promise<Response>):
  (request: object, context: object) => Promise<Response>;

export function fetch(url: string | Request, options?: RequestOptions): Promise<Response>;

export function tracingFetch(url: string | Request, options?: RequestOptions): Promise<Response>;

export const SPACECAT_USER_AGENT: string;

export function retrievePageAuthentication(site: object, context: object): Promise<string>;

export function prettifyLogForwardingConfig(payload: object): object;

export function isoCalendarWeek(date: Date): ISOCalendarWeek;

export function isoCalendarWeekSunday(date: Date): Date;

export function isoCalendarWeekMonday(date: Date): Date;

/**
 * Extracts URLs from a suggestion based on the opportunity type.
 * @param opts - Options object
 * @param opts.opportunity - The opportunity object
 * @param opts.suggestion - The suggestion object
 * @returns An array of extracted URLs
 */
export function extractUrlsFromSuggestion(opts: {
  opportunity: any;
  suggestion: any;
}): string[];

/**
 * Extracts URLs from an opportunity based on the opportunity type.
 * @param opts - Options object
 * @param opts.opportunity - The opportunity object
 * @returns An array of extracted URLs
 */
export function extractUrlsFromOpportunity(opts: {
  opportunity: any;
}): string[];

export * as llmoConfig from './llmo-config.js';
export * as schemas from './schemas.js';

export { type detectLocale } from './locale-detect/index.js';
