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

import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { fromJson, toJson } from '@bufbuild/protobuf';
import { BrandService } from './vendor/v2/brand/service_pb.js';
import { TopicService } from './vendor/v2/topic/service_pb.js';
import { PromptService } from './vendor/v2/prompt/service_pb.js';
import { SourceService } from './vendor/v2/source/service_pb.js';
import { CompetitorService } from './vendor/v2/competitor/service_pb.js';
import {
  CompetitorsMetrics,
  Meta as CrMeta,
} from './vendor/ai-cr/service_pb.js';
import { Sources as VoSources } from './vendor/ai-vo/service_pb.js';
import { Relations } from './vendor/ai-pr/service_pb.js';
import {
  BrandTopicsRequestSchema,
  BrandTopicsResponseSchema,
} from './vendor/v2/topic/messages_pb.js';
import {
  GapPromptsRequestSchema,
  GapPromptsResponseSchema,
} from './vendor/v2/prompt/messages_pb.js';
import {
  GAP_KIND_ENUM,
  COUNTRY_ENUM,
  LLM_ENUM,
} from './vendor/common/types_pb.js';

const DEFAULT_SCOPES = 'ai-seo.meta ai-seo.topics ai-seo.prompts ai-seo.sources ai-seo.brand-metrics ai-seo.relations ai-seo.competitors-metrics ai-seo.competitor';
const GRPC_BASE_URL = 'https://grpc-api.semrush.com';
const PROTO_FROM_JSON = { ignoreUnknownFields: true };
const PROTO_TO_JSON = { useProtoFieldName: false, alwaysEmitImplicit: true };

function semrushAiSeoOAuthTokenUrl(env) {
  const u = env.SEO_OAUTH_TOKEN_URL?.trim();
  if (u) {
    return u;
  }
  return new URL('/apis/v4-raw/auth/v0/oauth2/access_token', 'https://api.semrush.com').href;
}

export async function getAccessToken(env) {
  const id = env.SEO_CLIENT_ID;
  const secret = env.SEO_CLIENT_SECRET;
  if (!id?.trim() || !secret?.trim()) {
    throw new Error('SEO_CLIENT_ID and SEO_CLIENT_SECRET must be set');
  }
  const body = new URLSearchParams({
    client_id: id.trim(),
    client_secret: secret.trim(),
    scope: (env.SEO_OAUTH_SCOPES || DEFAULT_SCOPES).trim(),
    grant_type: 'client_credentials',
  });
  const r = await fetch(semrushAiSeoOAuthTokenUrl(env), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const j = await r.json();
  if (!j.access_token) {
    const oauthErr = typeof j.error === 'string' ? j.error : '';
    // eslint-disable-next-line no-console
    console.error('Semrush OAuth token request failed', { httpStatus: r.status, oauthError: oauthErr });
    throw new Error('Semrush OAuth token request failed');
  }
  return j.access_token;
}

export function createAuthInterceptor(env) {
  return (next) => async (req) => {
    const token = await getAccessToken(env);
    req.header.set('authorization', `Bearer ${token}`);
    return next(req);
  };
}

let cachedClients = null;

/**
 * Lazy-init gRPC transport + all Semrush AI SEO service clients.
 * Singleton per process — multiple callers share the same HTTP/2 connection pool.
 *
 * @param {Record<string, string>} env
 */
export function getGrpcClients(env) {
  if (cachedClients) {
    return cachedClients;
  }

  const transport = createGrpcTransport({
    baseUrl: GRPC_BASE_URL,
    httpVersion: '2',
    interceptors: [createAuthInterceptor(env)],
  });

  cachedClients = {
    brandClient: createClient(BrandService, transport),
    topicClient: createClient(TopicService, transport),
    promptClient: createClient(PromptService, transport),
    sourceClient: createClient(SourceService, transport),
    competitorClient: createClient(CompetitorService, transport),
    crMetricsClient: createClient(CompetitorsMetrics, transport),
    crMetaClient: createClient(CrMeta, transport),
    voSourcesClient: createClient(VoSources, transport),
    prRelationsClient: createClient(Relations, transport),
  };

  return cachedClients;
}

/** @visibleForTesting */
export function resetGrpcClients() {
  cachedClients = null;
}

/**
 * Fetches all brand topics for a domain from Semrush.
 * Returns a Map from lowercased topic name → topicHash (uint64 string).
 * Used to bridge the PostgREST topic UUID namespace to the Semrush hash namespace.
 *
 * @param {object} topicClient - Semrush TopicService client
 * @param {string} domain - bare domain (no protocol, no www)
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Map<string, string>>}
 */
export async function fetchTopicHashMap(topicClient, domain, { limit = 500 } = {}) {
  const request = fromJson(
    BrandTopicsRequestSchema,
    {
      target: { domain, name: domain },
      llm: LLM_ENUM.ALL,
      country: COUNTRY_ENUM.WORLDWIDE,
      range: { limit, offset: 0 },
    },
    PROTO_FROM_JSON,
  );

  const response = await topicClient.brandTopics(request);
  const json = /** @type {{ topics?: Array<{topic: string, topicHash: string}> }} */ (
    toJson(BrandTopicsResponseSchema, response, PROTO_TO_JSON)
  );

  const hashMap = new Map();
  for (const t of (json.topics ?? [])) {
    if (t.topic && t.topicHash) {
      hashMap.set(t.topic.toLowerCase(), t.topicHash);
    }
  }
  return hashMap;
}

/**
 * Fetches gap prompts (where competitors are cited but the brand is absent)
 * for a given Semrush topicHash.
 *
 * @param {object} promptClient - Semrush PromptService client
 * @param {string} topicHash - uint64 topic hash from Semrush
 * @param {string} domain - bare domain
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array>}
 */
export async function fetchGapPrompts(promptClient, topicHash, domain, { limit = 5 } = {}) {
  const request = fromJson(
    GapPromptsRequestSchema,
    {
      target: { domain, name: domain },
      llm: LLM_ENUM.ALL,
      country: COUNTRY_ENUM.WORLDWIDE,
      kinds: [GAP_KIND_ENUM.MISSING],
      topic_hash: topicHash,
      range: { limit, offset: 0 },
    },
    PROTO_FROM_JSON,
  );

  const response = await promptClient.gapPrompts(request);
  const json = /** @type {{ prompts?: Array }} */ (
    toJson(GapPromptsResponseSchema, response, PROTO_TO_JSON)
  );
  return json.prompts ?? [];
}
