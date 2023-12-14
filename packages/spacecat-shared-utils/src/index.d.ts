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

/** HTTP UTILS */

/**
 * Creates a 200 response with a JSON body.
 * @param {object} body - JSON body.
 * @return {Response} Response.
 */
export function ok(body: object): Response;

/**
 * Creates a 400 response with a JSON body.
 * @param {string} message - Error message.
 * @return {Response} Response.
 */
export function badRequest(message: string): Response;

/**
 * Creates a 404 response with a JSON body.
 * @param {string} message - Error message.
 * @return {Response} Response.
 */
export function notFound(message: string): Response;

/**
 * Creates a 500 response with a JSON body.
 * @param {string} message - Error message.
 * @return {Response} Response.
 */
export function internalServerError(message: string): Response;
