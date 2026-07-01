/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export interface GrpcClients {
  brandClient: import('@connectrpc/connect').Client<typeof import('@quazar/ai-seo-ts/v2/brand/service_pb.js').BrandService>;
  topicClient: import('@connectrpc/connect').Client<typeof import('@quazar/ai-seo-ts/v2/topic/service_pb.js').TopicService>;
  promptClient: import('@connectrpc/connect').Client<typeof import('@quazar/ai-seo-ts/v2/prompt/service_pb.js').PromptService>;
  sourceClient: import('@connectrpc/connect').Client<typeof import('@quazar/ai-seo-ts/v2/source/service_pb.js').SourceService>;
  competitorClient: import('@connectrpc/connect').Client<typeof import('@quazar/ai-seo-ts/v2/competitor/service_pb.js').CompetitorService>;
  crMetricsClient: unknown;
  crMetaClient: unknown;
  voSourcesClient: unknown;
  prRelationsClient: unknown;
}

export function getGrpcClients(env: Record<string, string | undefined>): GrpcClients;
export function resetGrpcClients(): void;
export function getAccessToken(env: Record<string, string | undefined>): Promise<string>;
export function createAuthInterceptor(env: Record<string, string | undefined>): (next: Function) => (req: any) => Promise<any>;
