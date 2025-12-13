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

import { isNonEmptyObject } from '@adobe/spacecat-shared-utils';
import crypto from 'crypto';
import Joi from 'joi';

import { getLogger } from '../../util/logger-registry.js';

export const IMPORT_TYPES = {
  LLMO_QUESTIONS_IMPORT_TYPE: 'llmo-prompts-ahrefs',
  ORGANIC_KEYWORDS: 'organic-keywords',
  ORGANIC_KEYWORDS_NONBRANDED: 'organic-keywords-nonbranded',
  ORGANIC_KEYWORDS_AI_OVERVIEW: 'organic-keywords-ai-overview',
  ORGANIC_KEYWORDS_FEATURE_SNIPPETS: 'organic-keywords-feature-snippets',
  ORGANIC_KEYWORDS_QUESTIONS: 'organic-keywords-questions',
  ORGANIC_TRAFFIC: 'organic-traffic',
  TOP_PAGES: 'top-pages',
  AHREF_PAID_PAGES: 'ahref-paid-pages',
  ALL_TRAFFIC: 'all-traffic',
  CWV_DAILY: 'cwv-daily',
  CWV_WEEKLY: 'cwv-weekly',
  TRAFFIC_ANALYSIS: 'traffic-analysis',
  TOP_FORMS: 'top-forms',
  CODE: 'code',
  USER_ENGAGEMENT: 'user-engagement',
};

export const IMPORT_DESTINATIONS = {
  DEFAULT: 'default',
};

export const IMPORT_SOURCES = {
  AHREFS: 'ahrefs',
  GSC: 'google',
  RUM: 'rum',
};

const LLMO_TAG_PATTERN = /^(market|product|topic):\s?.+/;
const LLMO_TAG = Joi.alternatives()
  .try(
    // Tag market, product, topic like this: "market: ch", "product: firefly", "topic: copyright"
    Joi.string().pattern(LLMO_TAG_PATTERN),
    Joi.string(),
  );

// LLMO question schema for both Human and AI questions
const QUESTION_SCHEMA = Joi.object({
  key: Joi.string().required(),
  question: Joi.string().required(),
  source: Joi.string().optional(),
  volume: Joi.string().optional(),
  keyword: Joi.string().optional(),
  url: Joi.string().uri().optional(),
  tags: Joi.array().items(LLMO_TAG).optional(),
  importTime: Joi.string().isoDate().optional(),
});

const LLMO_URL_PATTERN_SCHEMA = {
  urlPattern: Joi.string().uri().required(),
  tags: Joi.array().items(LLMO_TAG).optional(),
};
const LLMO_URL_PATTERNS_SCHEMA = Joi.array().items(LLMO_URL_PATTERN_SCHEMA);

const IMPORT_BASE_KEYS = {
  destinations: Joi.array().items(Joi.string().valid(IMPORT_DESTINATIONS.DEFAULT)).required(),
  sources: Joi.array().items(Joi.string().valid(...Object.values(IMPORT_SOURCES))).required(),
  // not required for now due backward compatibility
  enabled: Joi.boolean().default(true),
  url: Joi.string().uri().optional(), // optional url to override
};

export const IMPORT_TYPE_SCHEMAS = {
  [IMPORT_TYPES.LLMO_QUESTIONS_IMPORT_TYPE]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.LLMO_QUESTIONS_IMPORT_TYPE).required(),
    enabled: Joi.boolean().default(true),
    limit: Joi.number().integer().min(1).max(100)
      .optional(),
  }),
  [IMPORT_TYPES.ORGANIC_KEYWORDS]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.ORGANIC_KEYWORDS).required(),
    ...IMPORT_BASE_KEYS,
    geo: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(100)
      .optional(),
    pageUrl: Joi.string().uri().optional(),
  }),
  [IMPORT_TYPES.ORGANIC_KEYWORDS_NONBRANDED]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.ORGANIC_KEYWORDS_NONBRANDED).required(),
    ...IMPORT_BASE_KEYS,
    geo: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(100)
      .optional(),
    pageUrl: Joi.string().uri().optional(),
  }),
  [IMPORT_TYPES.ORGANIC_KEYWORDS_AI_OVERVIEW]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.ORGANIC_KEYWORDS_AI_OVERVIEW).required(),
    ...IMPORT_BASE_KEYS,
    geo: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(100)
      .optional(),
  }),
  [IMPORT_TYPES.ORGANIC_KEYWORDS_FEATURE_SNIPPETS]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.ORGANIC_KEYWORDS_FEATURE_SNIPPETS).required(),
    ...IMPORT_BASE_KEYS,
    geo: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(100)
      .optional(),
  }),
  [IMPORT_TYPES.ORGANIC_KEYWORDS_QUESTIONS]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.ORGANIC_KEYWORDS_QUESTIONS).required(),
    ...IMPORT_BASE_KEYS,
    geo: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(100)
      .optional(),
  }),
  [IMPORT_TYPES.ORGANIC_TRAFFIC]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.ORGANIC_TRAFFIC).required(),
    ...IMPORT_BASE_KEYS,
  }),
  [IMPORT_TYPES.ALL_TRAFFIC]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.ALL_TRAFFIC).required(),
    ...IMPORT_BASE_KEYS,
  }),
  [IMPORT_TYPES.TOP_PAGES]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.TOP_PAGES).required(),
    ...IMPORT_BASE_KEYS,
    geo: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(2000)
      .optional(),
  }),
  [IMPORT_TYPES.AHREF_PAID_PAGES]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.AHREF_PAID_PAGES).required(),
    ...IMPORT_BASE_KEYS,
    geo: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(2000)
      .optional(),
  }),
  [IMPORT_TYPES.CWV_DAILY]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.CWV_DAILY).required(),
    ...IMPORT_BASE_KEYS,
  }),
  [IMPORT_TYPES.CWV_WEEKLY]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.CWV_WEEKLY).required(),
    ...IMPORT_BASE_KEYS,
  }),
  [IMPORT_TYPES.TRAFFIC_ANALYSIS]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.TRAFFIC_ANALYSIS).required(),
    year: Joi.number().integer().optional(),
    week: Joi.number().integer().optional(),
    ...IMPORT_BASE_KEYS,
  }),
  [IMPORT_TYPES.TOP_FORMS]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.TOP_FORMS).required(),
    ...IMPORT_BASE_KEYS,
    limit: Joi.number().integer().min(1).max(2000)
      .optional(),
  }),
  [IMPORT_TYPES.USER_ENGAGEMENT]: Joi.object({
    type: Joi.string().valid(IMPORT_TYPES.USER_ENGAGEMENT).required(),
    ...IMPORT_BASE_KEYS,
  }),
};

export const DEFAULT_IMPORT_CONFIGS = {
  'organic-keywords': {
    type: 'organic-keywords',
    destinations: ['default'],
    sources: ['ahrefs'],
    enabled: true,
  },
  'organic-keywords-nonbranded': {
    type: 'organic-keywords-nonbranded',
    destinations: ['default'],
    sources: ['ahrefs'],
    enabled: true,
  },
  'organic-keywords-ai-overview': {
    type: 'organic-keywords-ai-overview',
    destinations: ['default'],
    sources: ['ahrefs'],
    enabled: true,
  },
  'organic-keywords-feature-snippets': {
    type: 'organic-keywords-feature-snippets',
    destinations: ['default'],
    sources: ['ahrefs'],
    enabled: true,
  },
  'organic-keywords-questions': {
    type: 'organic-keywords-questions',
    destinations: ['default'],
    sources: ['ahrefs'],
    enabled: true,
  },
  'organic-traffic': {
    type: 'organic-traffic',
    destinations: ['default'],
    sources: ['ahrefs'],
    enabled: true,
  },
  'all-traffic': {
    type: 'all-traffic',
    destinations: ['default'],
    sources: ['rum'],
    enabled: true,
  },
  'top-pages': {
    type: 'top-pages',
    destinations: ['default'],
    sources: ['ahrefs'],
    enabled: true,
    geo: 'global',
  },
  'ahref-paid-pages': {
    type: 'ahref-paid-pages',
    destinations: ['default'],
    sources: ['ahrefs'],
    enabled: true,
  },
  'cwv-daily': {
    type: 'cwv-daily',
    destinations: ['default'],
    sources: ['rum'],
    enabled: true,
  },
  'cwv-weekly': {
    type: 'cwv-weekly',
    destinations: ['default'],
    sources: ['rum'],
    enabled: true,
  },
  'traffic-analysis': {
    type: 'traffic-analysis',
    destinations: ['default'],
    sources: ['rum'],
    enabled: true,
  },
  'top-forms': {
    type: 'top-forms',
    destinations: ['default'],
    sources: ['rum'],
    enabled: true,
  },
  'user-engagement': {
    type: 'user-engagement',
    destinations: ['default'],
    sources: ['rum'],
    enabled: true,
  },
};

export const configSchema = Joi.object({
  slack: Joi.object({
    workspace: Joi.string(),
    channel: Joi.string(),
    invitedUserCount: Joi.number().integer().min(0),
  }),
  imports: Joi.array().items(
    Joi.alternatives().try(...Object.values(IMPORT_TYPE_SCHEMAS)),
  ),
  brandConfig: Joi.object({
    brandId: Joi.string().required(),
    userId: Joi.string().required(),
  }).optional(),
  brandProfile: Joi.object({
    // functional metadata
    version: Joi.number().integer().min(0),
    updatedAt: Joi.string().isoDate(),
    contentHash: Joi.string(),
    // generic top-level content containers (non-strict)
    discovery: Joi.any(),
    clustering: Joi.any(),
    competitive_context: Joi.any(),
    main_profile: Joi.any(),
    sub_brands: Joi.any(),
    confidence_score: Joi.any(),
    pages_considered: Joi.any(),
    diversity_assessment: Joi.any(),
  }).unknown(true).optional(),
  fetchConfig: Joi.object({
    headers: Joi.object().pattern(Joi.string(), Joi.string()),
    overrideBaseURL: Joi.string().uri().optional(),
  }).optional(),
  llmo: Joi.object({
    dataFolder: Joi.string().required(),
    brand: Joi.string().required(),
    questions: Joi.object({
      Human: Joi.array().items(QUESTION_SCHEMA).optional(),
      AI: Joi.array().items(QUESTION_SCHEMA).optional(),
    }).optional(),
    urlPatterns: LLMO_URL_PATTERNS_SCHEMA.optional(),
    customerIntent: Joi.array().items(
      Joi.object({
        key: Joi.string().required(),
        value: Joi.string().required(),
      }),
    ).optional(),
    filterConfig: Joi.array().items(
      Joi.object({
        key: Joi.string().required(),
        value: Joi.string().required(),
        records: Joi.array().items(Joi.string()).optional(),
      }),
    ).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    cdnlogsFilter: Joi.array().items(
      Joi.object({
        key: Joi.string().required(),
        value: Joi.array().items(Joi.string()).required(),
        type: Joi.string().valid('include', 'exclude').optional(),
      }),
    ).optional(),
    cdnBucketConfig: Joi.object({
      bucketName: Joi.string().optional(),
      orgId: Joi.string().optional(),
      cdnProvider: Joi.string().optional(),
    }).optional(),
  }).optional(),
  cdnLogsConfig: Joi.object({
    bucketName: Joi.string().required(),
    filters: Joi.array().items(
      Joi.object({
        key: Joi.string().required(),
        value: Joi.array().items(Joi.string()).required(),
        type: Joi.string().valid('include', 'exclude').optional(),
      }),
    ).optional(),
    outputLocation: Joi.string().required(),
  }).optional(),
  tokowakaConfig: Joi.object({
    apiKey: Joi.string().required(),
    forwardedHost: Joi.string().optional(),
  }).optional(),
  contentAiConfig: Joi.object({
    index: Joi.string().optional(),
  }).optional(),
  handlers: Joi.object().pattern(Joi.string(), Joi.object({
    mentions: Joi.object().pattern(Joi.string(), Joi.array().items(Joi.string())),
    excludedURLs: Joi.array().items(Joi.string()),
    manualOverwrites: Joi.array().items(Joi.object({
      brokenTargetURL: Joi.string().optional(),
      targetURL: Joi.string().optional(),
    })).optional(),
    fixedURLs: Joi.array().items(Joi.object({
      brokenTargetURL: Joi.string().optional(),
      targetURL: Joi.string().optional(),
    })).optional(),
    includedURLs: Joi.array().items(Joi.string()),
    groupedURLs: Joi.array().items(Joi.object({
      name: Joi.string(),
      pattern: Joi.string(),
    })).optional(),
    movingAvgThreshold: Joi.number().min(1).optional(),
    percentageChangeThreshold: Joi.number().min(1).optional(),
    latestMetrics: Joi.object({
      pageViewsChange: Joi.number(),
      ctrChange: Joi.number(),
      projectedTrafficValue: Joi.number(),
    }),
  }).unknown(true)).unknown(true),
}).unknown(true);

export const DEFAULT_CONFIG = {
  slack: {},
  handlers: {},
};

// Function to validate incoming configuration
export function validateConfiguration(config) {
  const { error, value } = configSchema.validate(config);

  if (error) {
    throw new Error(`Configuration validation error: ${error.message}`, { cause: error });
  }

  return value; // Validated and sanitized configuration
}

export function extractWellKnownTags(tags) {
  const wellKnownTags = {};
  for (const tag of tags) {
    if (LLMO_TAG_PATTERN.test(tag)) {
      const colonIdx = tag.indexOf(':');
      const value = tag.slice(colonIdx + 1).trim();
      if (colonIdx !== -1 && value) {
        wellKnownTags[tag.slice(0, colonIdx).trim()] = value;
      }
    }
  }
  return wellKnownTags;
}

export const Config = (data = {}) => {
  let configData;

  try {
    configData = validateConfiguration(data);
  } catch (error) {
    const logger = getLogger();
    if (logger && logger !== console) {
      logger.error('Site configuration validation failed, using provided data', {
        error: error.message,
        invalidConfig: data,
      });
    }
    configData = { ...data };
  }

  const state = { ...configData };
  const self = { state, extractWellKnownTags };
  self.getSlackConfig = () => state.slack;
  self.isInternalCustomer = () => state?.slack?.workspace === 'internal';
  self.getSlackMentions = (type) => state?.handlers?.[type]?.mentions?.slack;
  self.getHandlerConfig = (type) => state?.handlers?.[type];
  self.getContentAiConfig = () => state?.contentAiConfig;
  self.getHandlers = () => state.handlers;
  self.getImports = () => state.imports;
  self.getExcludedURLs = (type) => state?.handlers?.[type]?.excludedURLs;
  self.getManualOverwrites = (type) => state?.handlers?.[type]?.manualOverwrites;
  self.getFixedURLs = (type) => state?.handlers?.[type]?.fixedURLs;
  self.getIncludedURLs = (type) => state?.handlers?.[type]?.includedURLs;
  self.getGroupedURLs = (type) => state?.handlers?.[type]?.groupedURLs;
  self.getLatestMetrics = (type) => state?.handlers?.[type]?.latestMetrics;
  self.getFetchConfig = () => state?.fetchConfig;
  self.getBrandConfig = () => state?.brandConfig;
  self.getBrandProfile = () => state?.brandProfile;
  self.getCdnLogsConfig = () => state?.cdnLogsConfig;
  self.getLlmoConfig = () => state?.llmo;
  self.getLlmoDataFolder = () => state?.llmo?.dataFolder;
  self.getLlmoBrand = () => state?.llmo?.brand;
  self.getLlmoUrlPatterns = () => state?.llmo?.urlPatterns;
  self.getLlmoCustomerIntent = () => {
    const llmoConfig = self.getLlmoConfig();
    return llmoConfig?.customerIntent || [];
  };
  self.getLlmoCdnlogsFilter = () => state?.llmo?.cdnlogsFilter;
  self.getLlmoCdnBucketConfig = () => state?.llmo?.cdnBucketConfig;
  self.getTokowakaConfig = () => state?.tokowakaConfig;

  self.updateSlackConfig = (channel, workspace, invitedUserCount) => {
    state.slack = {
      channel,
      workspace,
      invitedUserCount,
    };
  };

  self.updateLlmoConfig = (dataFolder, brand, urlPatterns = undefined) => {
    const currentLlmoConfig = state.llmo || {};
    state.llmo = {
      ...currentLlmoConfig,
      dataFolder,
      brand,
      urlPatterns,
    };
  };

  self.updateLlmoDataFolder = (dataFolder) => {
    state.llmo = state.llmo || {};
    state.llmo.dataFolder = dataFolder;
  };

  self.updateLlmoBrand = (brand) => {
    state.llmo = state.llmo || {};
    state.llmo.brand = brand;
  };

  self.addLlmoCustomerIntent = (customerIntentItems) => {
    state.llmo = state.llmo || {};
    state.llmo.customerIntent = state.llmo.customerIntent || [];
    state.llmo.customerIntent.push(...customerIntentItems);
  };

  self.removeLlmoCustomerIntent = (intentKey) => {
    state.llmo = state.llmo || {};
    state.llmo.customerIntent = state.llmo.customerIntent || [];

    const currentCustomerIntent = state.llmo.customerIntent;
    const firstOccurrenceIndex = currentCustomerIntent.findIndex(
      (item) => item.key === intentKey,
    );

    if (firstOccurrenceIndex !== -1) {
      state.llmo.customerIntent = currentCustomerIntent.filter(
        (item, index) => index !== firstOccurrenceIndex,
      );
    }
  };

  self.updateLlmoCustomerIntent = (intentKey, updateData) => {
    state.llmo = state.llmo || {};
    state.llmo.customerIntent = state.llmo.customerIntent || [];

    const currentCustomerIntent = state.llmo.customerIntent;
    const firstOccurrenceIndex = currentCustomerIntent.findIndex(
      (item) => item.key === intentKey,
    );

    if (firstOccurrenceIndex !== -1) {
      state.llmo.customerIntent = currentCustomerIntent.map((item, index) => {
        if (index === firstOccurrenceIndex) {
          return { ...item, ...updateData };
        }
        return item;
      });
    }
  };

  self.addLlmoUrlPatterns = (urlPatterns) => {
    Joi.assert(urlPatterns, LLMO_URL_PATTERNS_SCHEMA, 'Invalid URL patterns');

    state.llmo ??= {};
    state.llmo.urlPatterns ??= [];
    const byPattern = new Map(
      state.llmo.urlPatterns.map((p) => [p.urlPattern, p]),
    );
    for (const p of urlPatterns) {
      byPattern.set(p.urlPattern, p);
    }

    state.llmo.urlPatterns = [...byPattern.values()];
  };

  self.replaceLlmoUrlPatterns = (urlPatterns) => {
    Joi.assert(urlPatterns, LLMO_URL_PATTERNS_SCHEMA, 'Invalid URL patterns');
    state.llmo ??= {};
    state.llmo.urlPatterns = urlPatterns;
  };

  self.removeLlmoUrlPattern = (urlPattern) => {
    const urlPatterns = state.llmo?.urlPatterns;
    if (!urlPatterns) return;

    state.llmo.urlPatterns = urlPatterns.filter(
      (pattern) => pattern.urlPattern !== urlPattern,
    );
  };

  self.updateLlmoCdnlogsFilter = (cdnlogsFilter) => {
    state.llmo = state.llmo || {};
    state.llmo.cdnlogsFilter = cdnlogsFilter;
  };

  self.updateLlmoCdnBucketConfig = (cdnBucketConfig) => {
    state.llmo = state.llmo || {};
    state.llmo.cdnBucketConfig = cdnBucketConfig;
  };

  self.updateImports = (imports) => {
    state.imports = imports;
  };

  self.updateSlackMentions = (type, mentions) => {
    state.handlers = state.handlers || {};
    state.handlers[type] = state.handlers[type] || {};
    state.handlers[type].mentions = state.handlers[type].mentions || {};
    state.handlers[type].mentions.slack = mentions;
  };

  self.updateExcludedURLs = (type, excludedURLs) => {
    state.handlers = state.handlers || {};
    state.handlers[type] = state.handlers[type] || {};
    state.handlers[type].excludedURLs = excludedURLs;
  };

  self.updateManualOverwrites = (type, manualOverwrites) => {
    state.handlers = state.handlers || {};
    state.handlers[type] = state.handlers[type] || {};
    state.handlers[type].manualOverwrites = manualOverwrites;
  };

  self.updateFixedURLs = (type, fixedURLs) => {
    state.handlers = state.handlers || {};
    state.handlers[type] = state.handlers[type] || {};
    state.handlers[type].fixedURLs = fixedURLs;
  };

  self.updateGroupedURLs = (type, groupedURLs) => {
    state.handlers = state.handlers || {};
    state.handlers[type] = state.handlers[type] || {};
    state.handlers[type].groupedURLs = groupedURLs;

    validateConfiguration(state);
  };

  self.updateLatestMetrics = (type, latestMetrics) => {
    state.handlers = state.handlers || {};
    state.handlers[type] = state.handlers[type] || {};
    state.handlers[type].latestMetrics = latestMetrics;
  };

  self.updateFetchConfig = (fetchConfig) => {
    state.fetchConfig = fetchConfig;
  };

  self.updateBrandConfig = (brandConfig) => {
    state.brandConfig = brandConfig;
  };

  /**
   * Updates the top-level brandProfile with versioning and content hashing.
   * Version is incremented only if the meaningful content changes.
   * @param {object} newProfile
   */
  self.updateBrandProfile = (newProfile = {}) => {
    const prior = state.brandProfile || {};
    // compute hash over all content except functional fields
    const stripFunctional = (p) => {
      if (!isNonEmptyObject(p)) return {};
      const {
        /* eslint-disable no-unused-vars */
        version, updatedAt, contentHash, ...rest
      } = p;
      return rest;
    };
    const meaningful = stripFunctional(newProfile);
    const contentHash = crypto.createHash('sha256')
      .update(JSON.stringify(meaningful))
      .digest('hex');

    if (prior?.contentHash === contentHash) {
      state.brandProfile = {
        ...prior,
        ...newProfile,
        contentHash: prior.contentHash,
        version: prior.version,
        updatedAt: prior.updatedAt,
      };
      return;
    }

    const version = (prior?.version || 0) + 1;
    state.brandProfile = {
      ...prior,
      ...meaningful,
      version,
      contentHash,
      updatedAt: new Date().toISOString(),
    };
  };

  self.enableImport = (type, config = {}) => {
    if (!IMPORT_TYPE_SCHEMAS[type]) {
      throw new Error(`Unknown import type: ${type}`);
    }

    const defaultConfig = DEFAULT_IMPORT_CONFIGS[type];
    const newConfig = {
      ...defaultConfig, ...config, type, enabled: true,
    };

    // Validate the new config against its schema
    const { error } = IMPORT_TYPE_SCHEMAS[type].validate(newConfig);
    if (error) {
      throw new Error(`Invalid import config: ${error.message}`);
    }

    state.imports = state.imports || [];
    // Remove existing import of same type if present
    state.imports = state.imports.filter((imp) => imp.type !== type);
    state.imports.push(newConfig);

    validateConfiguration(state);
  };

  self.disableImport = (type) => {
    if (!state.imports) return;

    state.imports = state.imports.map(
      (imp) => (imp.type === type ? { ...imp, enabled: false } : imp),
    );

    validateConfiguration(state);
  };

  self.getImportConfig = (type) => state.imports?.find((imp) => imp.type === type);

  self.isImportEnabled = (type) => {
    const config = self.getImportConfig(type);
    return config?.enabled ?? false;
  };

  self.updateCdnLogsConfig = (cdnLogsConfig) => {
    state.cdnLogsConfig = cdnLogsConfig;
  };

  self.updateTokowakaConfig = (tokowakaConfig) => {
    state.tokowakaConfig = tokowakaConfig;
  };

  return Object.freeze(self);
};

Config.fromDynamoItem = (dynamoItem) => Config(dynamoItem);

Config.toDynamoItem = (config) => ({
  slack: config.getSlackConfig(),
  handlers: config.getHandlers(),
  contentAiConfig: config.getContentAiConfig(),
  imports: config.getImports(),
  fetchConfig: config.getFetchConfig(),
  brandConfig: config.getBrandConfig(),
  brandProfile: config.getBrandProfile(),
  cdnLogsConfig: config.getCdnLogsConfig(),
  llmo: config.getLlmoConfig(),
  tokowakaConfig: config.getTokowakaConfig(),
});
