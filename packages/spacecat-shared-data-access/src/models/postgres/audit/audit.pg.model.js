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

import {
  isArray,
  isObject,
  isBoolean,
  isNumber,
} from '@adobe/spacecat-shared-utils';

import { ValidationError } from '../../../errors/index.js';
import PostgresBaseModel from '../base/postgres-base.model.js';

/**
 * PostgresAuditModel - A Postgres-backed Audit entity model.
 * Mirrors the v2 Audit model's statics and custom methods.
 *
 * @class PostgresAuditModel
 * @extends PostgresBaseModel
 */
class PostgresAuditModel extends PostgresBaseModel {
  static ENTITY_NAME = 'Audit';

  static AUDIT_TYPES = {
    APEX: 'apex',
    CWV: 'cwv',
    LHS_MOBILE: 'lhs-mobile',
    LHS_DESKTOP: 'lhs-desktop',
    404: '404',
    SITEMAP: 'sitemap',
    CANONICAL: 'canonical',
    REDIRECT_CHAINS: 'redirect-chains',
    BROKEN_BACKLINKS: 'broken-backlinks',
    BROKEN_INTERNAL_LINKS: 'broken-internal-links',
    CONTENT_FRAGMENT_UNUSED: 'content-fragment-unused',
    CONTENT_FRAGMENT_UNUSED_AUTO_FIX: 'content-fragment-unused-auto-fix',
    EXPERIMENTATION: 'experimentation',
    CONVERSION: 'conversion',
    ORGANIC_KEYWORDS: 'organic-keywords',
    ORGANIC_TRAFFIC: 'organic-traffic',
    EXPERIMENTATION_ESS_DAILY: 'experimentation-ess-daily',
    EXPERIMENTATION_ESS_MONTHLY: 'experimentation-ess-monthly',
    EXPERIMENTATION_OPPORTUNITIES: 'experimentation-opportunities',
    META_TAGS: 'meta-tags',
    LLM_ERROR_PAGES: 'llm-error-pages',
    COSTS: 'costs',
    STRUCTURED_DATA: 'structured-data',
    STRUCTURED_DATA_AUTO_SUGGEST: 'structured-data-auto-suggest',
    FORMS_OPPORTUNITIES: 'forms-opportunities',
    SITE_DETECTION: 'site-detection',
    ALT_TEXT: 'alt-text',
    ACCESSIBILITY: 'accessibility',
    SECURITY_CSP: 'security-csp',
    SECURITY_VULNERABILITIES: 'security-vulnerabilities',
    SECURITY_PERMISSIONS: 'security-permissions',
    SECURITY_REDUNDANT: 'security-permissions-redundant',
    PAID: 'paid',
    HREFLANG: 'hreflang',
    HEADINGS: 'headings',
    PAID_TRAFFIC_ANALYSIS_WEEKLY: 'paid-traffic-analysis-weekly',
    PAID_TRAFFIC_ANALYSIS_MONTHLY: 'paid-traffic-analysis-monthly',
    READABILITY: 'readability',
    PRERENDER: 'prerender',
    PRODUCT_METATAGS: 'product-metatags',
    PRODUCT_METATAGS_AUTO_SUGGEST: 'product-metatags-auto-suggest',
    PRODUCT_METATAGS_AUTO_FIX: 'product-metatags-auto-fix',
    SUMMARIZATION: 'summarization',
    PAGE_TYPE_DETECTION: 'page-type-detection',
    FAQS: 'faqs',
    CDN_LOGS_ANALYSIS: 'cdn-logs-analysis',
    CDN_LOGS_REPORT: 'cdn-logs-report',
    LLMO_REFERRAL_TRAFFIC: 'llmo-referral-traffic',
    PAGE_INTENT: 'page-intent',
    NO_CTA_ABOVE_THE_FOLD: 'no-cta-above-the-fold',
    TOC: 'toc',
    WIKIPEDIA_ANALYSIS: 'wikipedia-analysis',
    COMMERCE_PRODUCT_ENRICHMENTS: 'commerce-product-enrichments',
    COMMERCE_PRODUCT_PAGE_ENRICHMENT: 'commerce-product-page-enrichment',
    COMMERCE_PRODUCT_CATALOG_ENRICHMENT: 'commerce-product-catalog-enrichment',
  };

  static AUDIT_TYPE_PROPERTIES = {
    [PostgresAuditModel.AUDIT_TYPES.LHS_DESKTOP]: ['performance', 'seo', 'accessibility', 'best-practices'],
    [PostgresAuditModel.AUDIT_TYPES.LHS_MOBILE]: ['performance', 'seo', 'accessibility', 'best-practices'],
  };

  static AUDIT_CONFIG = {
    TYPES: PostgresAuditModel.AUDIT_TYPES,
    PROPERTIES: PostgresAuditModel.AUDIT_TYPE_PROPERTIES,
  };

  static AUDIT_STEP_DESTINATIONS = {
    CONTENT_SCRAPER: 'content-scraper',
    IMPORT_WORKER: 'import-worker',
    SCRAPE_CLIENT: 'scrape-client',
  };

  static AUDIT_STEP_DESTINATION_CONFIGS = {
    [PostgresAuditModel.AUDIT_STEP_DESTINATIONS.IMPORT_WORKER]: {
      getQueueUrl: (context) => context.env?.IMPORT_WORKER_QUEUE_URL,
      formatPayload: (stepResult, auditContext) => ({
        type: stepResult.type,
        siteId: stepResult.siteId,
        pageUrl: stepResult.pageUrl,
        startDate: stepResult.startDate,
        endDate: stepResult.endDate,
        urlConfigs: stepResult.urlConfigs,
        allowCache: isBoolean(stepResult.allowCache) ? stepResult.allowCache : true,
        auditContext,
      }),
    },
    [PostgresAuditModel.AUDIT_STEP_DESTINATIONS.CONTENT_SCRAPER]: {
      getQueueUrl: (context) => context.env?.CONTENT_SCRAPER_QUEUE_URL,
      formatPayload: (stepResult, auditContext, context) => ({
        urls: stepResult.urls,
        jobId: stepResult.siteId,
        processingType: stepResult.processingType || 'default',
        skipMessage: false,
        allowCache: isBoolean(stepResult.allowCache) ? stepResult.allowCache : true,
        options: stepResult.options || {},
        completionQueueUrl: stepResult.completionQueueUrl || context.env?.AUDIT_JOBS_QUEUE_URL,
        auditContext,
      }),
    },
    [PostgresAuditModel.AUDIT_STEP_DESTINATIONS.SCRAPE_CLIENT]: {
      formatPayload: (stepResult, auditContext, context) => {
        const payload = {
          urls: stepResult.urls.map((urlObj) => urlObj.url),
          processingType: stepResult.processingType || 'default',
          options: stepResult.options || {},
          maxScrapeAge: isNumber(stepResult.maxScrapeAge) ? stepResult.maxScrapeAge : 24,
          metaData: {
            auditData: {
              siteId: stepResult.siteId,
              completionQueueUrl:
                stepResult.completionQueueUrl || context.env?.AUDIT_JOBS_QUEUE_URL || '',
              auditContext,
            },
          },
        };

        if (context.traceId) {
          payload.traceId = context.traceId;
        }

        return payload;
      },
    },
  };

  /**
   * Validates if the auditResult contains the required properties for the given audit type.
   * @param {object} auditResult - The audit result to validate.
   * @param {string} auditType - The type of the audit.
   * @returns {boolean} - True if valid, false otherwise.
   */
  static validateAuditResult = (auditResult, auditType) => {
    if (!isObject(auditResult) && !isArray(auditResult)) {
      throw new ValidationError('Audit result must be an object or array');
    }

    if (isObject(auditResult.runtimeError)) {
      return true;
    }

    if ((
      auditType === PostgresAuditModel.AUDIT_CONFIG.TYPES.LHS_MOBILE
        || auditType === PostgresAuditModel.AUDIT_CONFIG.TYPES.LHS_DESKTOP
    )
      && !isObject(auditResult.scores)) {
      throw new ValidationError(`Missing scores property for audit type '${auditType}'`);
    }

    const expectedProperties = PostgresAuditModel.AUDIT_CONFIG.PROPERTIES[auditType];

    if (expectedProperties) {
      for (const prop of expectedProperties) {
        if (!(prop in auditResult.scores)) {
          throw new ValidationError(`Missing expected property '${prop}' for audit type '${auditType}'`);
        }
      }
    }

    return true;
  };

  getScores() {
    return this.getAuditResult()?.scores;
  }
}

export default PostgresAuditModel;
