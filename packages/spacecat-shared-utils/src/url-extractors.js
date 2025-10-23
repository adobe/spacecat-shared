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

import { OPPORTUNITY_TYPES } from './constants.js';

/**
 * Function to extract the URL from a suggestion based on a particular type
 * @param {*} suggestion
 */
function extractUrlFromSuggestion(opts) {
  const {
    opportunity,
    suggestion,
  } = opts;

  const urls = [];

  try {
    const opportunityType = opportunity.getType();
    const data = suggestion.getData ? suggestion.getData() : suggestion.data;

    switch (opportunityType) {
      case OPPORTUNITY_TYPES.ALT_TEXT:
        {
          const recommendations = data?.recommendations;
          if (Array.isArray(recommendations)) {
            recommendations.forEach((rec) => {
              if (rec.pageUrl && typeof rec.pageUrl === 'string') {
                urls.push(rec.pageUrl);
              }
            });
          }
        }
        break;
      case OPPORTUNITY_TYPES.ACCESSIBILITY:
      case OPPORTUNITY_TYPES.COLOR_CONTRAST:
      case OPPORTUNITY_TYPES.STRUCTURED_DATA:
      case OPPORTUNITY_TYPES.CANONICAL:
      case OPPORTUNITY_TYPES.HREFLANG:
      case OPPORTUNITY_TYPES.HEADINGS:
      case OPPORTUNITY_TYPES.INVALID_OR_MISSING_METADATA:
      case OPPORTUNITY_TYPES.SITEMAP_PRODUCT_COVERAGE:
        {
          const url = data?.url;
          if (url && typeof url === 'string') {
            urls.push(url);
          }
        }
        break;
      case OPPORTUNITY_TYPES.CWV:
        {
          const { type } = data;
          const url = data?.url;
          if (type === 'url' && url && typeof url === 'string') {
            urls.push(url);
          }
        }
        break;
      case OPPORTUNITY_TYPES.REDIRECT_CHAINS:
        {
          const sourceUrl = data?.sourceUrl;
          if (sourceUrl && typeof sourceUrl === 'string') {
            urls.push(sourceUrl);
          }
        }
        break;
      case OPPORTUNITY_TYPES.SECURITY_XSS:
        {
          const url = data?.link;
          if (url && typeof url === 'string') {
            urls.push(url);
          }
        }
        break;
      case OPPORTUNITY_TYPES.SECURITY_CSP:
        {
          const findings = data?.findings;
          if (Array.isArray(findings)) {
            findings.forEach((finding) => {
              if (finding.url && typeof finding.url === 'string') {
                urls.push(finding.url);
              }
            });
          }
        }
        break;
      case OPPORTUNITY_TYPES.SECURITY_PERMISSIONS:
        {
          const url = data?.path;
          if (url && typeof url === 'string') {
            urls.push(url);
          }
        }
        break;
      case OPPORTUNITY_TYPES.BROKEN_BACKLINKS:
      case OPPORTUNITY_TYPES.BROKEN_INTERNAL_LINKS:
        {
          const url = data?.url_to;
          if (url && typeof url === 'string') {
            urls.push(url);
          }
        }
        break;
      case OPPORTUNITY_TYPES.SITEMAP:
        {
          const url = data?.pageUrl;
          if (url && typeof url === 'string') {
            urls.push(url);
          }
        }
        break;
      default:
        break;
    }
  } catch (error) {
    // Silently handle errors and return empty array
  }
  return urls;
}

/**
 * Function to extract the URL from an opportunity based on a particular type
 * @param {*} opportunity
 */
function extractUrlFromOpportunity(opts) {
  const {
    opportunity,
  } = opts;
  const urls = [];

  try {
    const opportunityType = opportunity.getType();
    const data = opportunity.getData ? opportunity.getData() : opportunity.data;

    switch (opportunityType) {
      case OPPORTUNITY_TYPES.HIGH_ORGANIC_LOW_CTR:
        {
          const url = data?.page;
          if (url && typeof url === 'string') {
            urls.push(url);
          }
        }
        break;
      case OPPORTUNITY_TYPES.HIGH_FORM_VIEWS_LOW_CONVERSIONS:
      case OPPORTUNITY_TYPES.HIGH_PAGE_VIEWS_LOW_FORM_NAV:
      case OPPORTUNITY_TYPES.HIGH_PAGE_VIEWS_LOW_FORM_VIEWS:
        {
          const url = data?.form;
          if (url && typeof url === 'string') {
            urls.push(url);
          }
        }
        break;
      case OPPORTUNITY_TYPES.FORM_ACCESSIBILITY:
        {
          const url = data?.url;
          if (url && typeof url === 'string') {
            urls.push(url);
          }
        }
        break;
      default:
        break;
    }
  } catch (error) {
    // Silently handle errors and return empty array
  }
  return urls;
}

export {
  extractUrlFromSuggestion,
  extractUrlFromOpportunity,
};
