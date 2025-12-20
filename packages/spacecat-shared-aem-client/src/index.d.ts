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

// Error Classes
export class AemClientError extends Error {
  statusCode: number;
  errorCode: string;
  constructor(message: string, statusCode?: number, errorCode?: string);
}

export class AemBadRequestError extends AemClientError {
  parameter: string;
  constructor(message: string, parameter: string);
}

export class AemConfigurationError extends AemBadRequestError {
  constructor(message: string, parameter: string);
}

export class AemAuthenticationError extends AemClientError {
  reason: string;
  constructor(message: string, reason?: string);
}

export class AemForbiddenError extends AemClientError {
  resource: string | null;
  constructor(message: string, resource?: string | null);
}

export class AemConflictError extends AemClientError {
  resource: string | null;
  constructor(message: string, resource?: string | null);
}

export class AemPreconditionFailedError extends AemClientError {
  resource: string | null;
  constructor(message: string, resource?: string | null);
}

export class AemRequestError extends AemClientError {
  responseBody: string | null;
  constructor(statusCode: number, message: string, responseBody?: string | null);
  static fromStatusCode(statusCode: number, message: string, context?: { resource?: string; parameter?: string }): AemClientError;
}

export class FragmentNotFoundError extends AemClientError {
  fragmentPath: string;
  constructor(fragmentPath: string);
}

export class FragmentStateError extends AemClientError {
  fragmentPath: string;
  reason: string;
  constructor(fragmentPath: string, reason: string);
}

// Interfaces
interface Logger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug?(...args: unknown[]): void;
  warn?(...args: unknown[]): void;
}

interface Site {
  getDeliveryConfig(): { authorURL?: string };
}

interface AemClientContext {
  site: Site;
  env: {
    IMS_HOST: string;
    IMS_CLIENT_ID: string;
    IMS_CLIENT_CODE: string;
    IMS_CLIENT_SECRET: string;
    IMS_SCOPE?: string;
  };
  log?: Logger;
}

interface FragmentField {
  name: string;
  type: string;
  multiple: boolean;
  values: unknown[];
}

interface CreateFragmentData {
  title: string;
  name: string;
  modelId: string;
  fields?: FragmentField[];
}

interface FragmentData {
  id: string;
  title: string;
  etag?: string;
  [key: string]: unknown;
}

interface TagsResult {
  items: Array<{ id: string; [key: string]: unknown }>;
  etag?: string;
}

interface VersionOptions {
  label?: string;
  comment?: string;
}

interface VersionData {
  [key: string]: unknown;
}

interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: unknown;
  from?: string;
}

interface AemBaseClient {
  request(
    method: string,
    path: string,
    body?: object | null,
    additionalHeaders?: Record<string, string>
  ): Promise<object | null>;
  log: Logger;
}

/**
 * Handles Content Fragment operations via the AEM Sites API.
 */
export class FragmentManagement {
  readonly client: AemBaseClient;
  constructor(client: AemBaseClient);
  resolveFragmentId(fragmentPath: string): Promise<string>;
  createFragment(parentPath: string, data: CreateFragmentData): Promise<FragmentData>;
  getFragmentById(fragmentId: string): Promise<FragmentData>;
  getFragment(fragmentPath: string): Promise<FragmentData>;
  patchFragmentById(fragmentId: string, patches: JsonPatchOperation[]): Promise<FragmentData>;
  patchFragment(fragmentPath: string, patches: JsonPatchOperation[]): Promise<FragmentData>;
  deleteFragmentById(fragmentId: string): Promise<null>;
  deleteFragment(fragmentPath: string): Promise<null>;
}

/**
 * Handles Content Fragment versioning operations via the AEM Sites API.
 */
export class FragmentVersioning {
  readonly client: AemBaseClient;
  constructor(client: AemBaseClient);
  createVersion(fragmentId: string, options?: VersionOptions): Promise<VersionData>;
}

/**
 * Handles Content Fragment tagging operations via the AEM Sites API.
 */
export class FragmentTagging {
  readonly client: AemBaseClient;
  constructor(client: AemBaseClient);
  addTags(fragmentId: string, tagIds: string[]): Promise<TagsResult>;
  getTags(fragmentId: string): Promise<TagsResult>;
  replaceTags(fragmentId: string, tagIds: string[]): Promise<TagsResult>;
  deleteTags(fragmentId: string): Promise<void>;
}

interface BuiltClient {
  client: AemBaseClient;
  management: FragmentManagement | null;
  versioning: FragmentVersioning | null;
  tagging: FragmentTagging | null;
}

/**
 * Builder for creating AEM client instances with selected capabilities.
 */
export class AemClientBuilder {
  constructor(client: AemBaseClient);
  static create(context: AemClientContext): AemClientBuilder;

  withManagement(): AemClientBuilder;
  withVersioning(): AemClientBuilder;
  withTagging(): AemClientBuilder;

  build(): BuiltClient;
}

// API Constants
export const API_SITES_BASE: string;
export const API_SITES_CF_FRAGMENTS: string;
export const API_SITES_FRAGMENT_VERSIONS: string;
export const API_SITES_FRAGMENT_TAGS: string;
