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

/** UTILITY FUNCTIONS */
export function arrayEquals<T>(a: T[], b: T[]): boolean;

export function hasText(str: string): boolean;

export function isBoolean(value: unknown): boolean;

export function isInteger(value: unknown): boolean;

export function isValidDate(value: unknown): boolean;

export function isIsoDate(str: string): boolean;

export function isIsoTimeOffsetsDate(str: string): boolean;

export function isNumber(value: unknown): boolean;

export function isObject(value: unknown): boolean;

export function isString(value: unknown): boolean;

export function toBoolean(value: unknown): boolean;

export function isValidUrl(urlString: string): boolean;

export function dateAfterDays(days: string): Date;

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
