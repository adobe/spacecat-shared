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

/**
 * Delivery types for AEM deployment
 */
export const DELIVERY_TYPES = {
  AEM_CS: 'aem_cs',
  AEM_EDGE: 'aem_edge',
  AEM_AMS: 'aem_ams',
  AEM_HEADLESS: 'aem_headless',
  OTHER: 'other',
};

/**
 * Detects the AEM delivery type from HTML source code
 * @param {string} htmlSource - The HTML source code of the page
 * @return {string|null} - 'aem_edge', 'aem_cs', 'aem_ams', 'aem_headless'
 * or 'other' if undetermined, null if no HTML source is provided
 */
export function detectAEMVersion(htmlSource, headers = {}) {
  if (!htmlSource || typeof htmlSource !== 'string') {
    return null;
  }

  // Create a normalized version of the HTML for simpler pattern matching
  const normalizedHtml = htmlSource.toLowerCase();

  // EDS Indicators
  const edsPatterns = [
    // Core library references
    /lib-franklin\.js/i,
    /aem\.js/i,
    // Block structure
    /data-block-status/i,
    // Franklin-specific markup patterns
    /scripts\.js/i,
    // Block HTML patterns
    /<div class="[^"]*block[^"]*"[^>]*>/i,
    // RUM data-routing for EDS
    /data-routing="[^"]*eds=([^,"]*)/i,
  ];

  // CS Indicators (Cloud Service)
  const csPatterns = [
    // Core Components patterns
    /<div class="[^"]*cmp-[^"]*"[^>]*>/i,
    // CS-specific clientlib pattern with lc- prefix/suffix
    // (more specific than general etc.clientlibs)
    /\/etc\.clientlibs\/[^"']+\.lc-[a-f0-9]+-lc\.min\.(js|css)/i,
    // Modern libs clientlib paths
    /\/libs\.clientlibs\//i,
    // Core components comments or data attributes
    /data-cmp-/i,
    /data-sly-/i,
    // Cloud Manager references
    /content\/experience-fragments\//i,
    // SPA editor references
    /data-cq-/i,
    // RUM data-routing for CS
    /data-routing="[^"]*cs=([^,"]*)/i,
  ];

  // AMS Indicators (Managed Services) - typically older AEM patterns
  const amsPatterns = [
    // Legacy clientlib paths
    /\/etc\/clientlibs\//i,
    /\/etc\/designs\//i,
    // AMS-specific clientlib pattern with fingerprinted hashes (both JS and CSS)
    /\/etc\.clientlibs\/[^"']+\.min\.[a-f0-9]{32}\.(js|css)/i,
    // Classic UI patterns
    /foundation-/i,
    /cq:template/i,
    /cq-commons/i,
    // Legacy component patterns
    /parsys/i,
    // Legacy CQ references
    /\/CQ\//i,
    /\/apps\//i,
    // RUM data-routing for AMS
    /data-routing="[^"]*ams=([^,"]*)/i,
  ];

  const amsHeaderPatterns = [
    /^dispatcher[0-9].*$/,
  ];

  const aemHeadlessPatterns = [
    /aem-headless/i,
    /\/content\/dam\//i,
  ];

  // Count matches for each type
  let edsMatches = 0;
  let csMatches = 0;
  let amsMatches = 0;
  let aemHeadlessMatches = 0;

  // Check EDS patterns
  for (const pattern of edsPatterns) {
    if (pattern.test(normalizedHtml)) {
      edsMatches += 1;
    }
  }

  // Check CS patterns
  for (const pattern of csPatterns) {
    if (pattern.test(normalizedHtml)) {
      csMatches += 1;
    }
  }

  // Check AMS patterns
  for (const pattern of amsPatterns) {
    if (pattern.test(normalizedHtml)) {
      amsMatches += 1;
    }
  }

  // Check AMS header patterns
  for (const pattern of amsHeaderPatterns) {
    if (pattern.test(headers['x-dispatcher'])) {
      amsMatches += 1;
    }
  }

  for (const pattern of aemHeadlessPatterns) {
    if (pattern.test(normalizedHtml)) {
      aemHeadlessMatches += 1;
    }
  }

  // Check for decisive indicators with higher weight
  if (normalizedHtml.includes('lib-franklin.js') || normalizedHtml.includes('aem.js')) {
    edsMatches += 3;
  }

  // Only give CS weight for core components, but reduced since they can exist in AMS too
  if (normalizedHtml.match(/class="[^"]*cmp-[^"]*"/)) {
    csMatches += 1; // Reduced weight since core components can exist in both AMS and CS
  }

  // Check for decisive indicators with higher weight
  if (normalizedHtml.includes('/etc/designs/') || normalizedHtml.includes('foundation-')) {
    amsMatches += 2;
  }

  // Check for decisive indicators with higher weight
  // Give extra weight to AMS clientlib format pattern as it's very distinctive
  if (/\/etc\.clientlibs\/[^"']+\.min\.[a-f0-9]{32}\.(js|css)/i.test(normalizedHtml)) {
    amsMatches += 5; // Increased weight since this is a very reliable AMS indicator
  }

  // Give extra weight to CS clientlib format pattern as it's very distinctive
  if (/\/etc\.clientlibs\/[^"']+\.lc-[a-f0-9]+-lc\.min\.(js|css)/i.test(normalizedHtml)) {
    csMatches += 3;
  }

  // Give significant weight to explicit RUM data-routing indicators
  if (/data-routing="[^"]*ams=([^,"]*)/i.test(normalizedHtml)) {
    amsMatches += 5;
  }

  if (/data-routing="[^"]*eds=([^,"]*)/i.test(normalizedHtml)) {
    edsMatches += 5;
  }

  if (/data-routing="[^"]*cs=([^,"]*)/i.test(normalizedHtml)) {
    csMatches += 5;
  }

  // Determine the most likely version based on match counts
  const maxMatches = Math.max(edsMatches, csMatches, amsMatches, aemHeadlessMatches);

  // Require a minimum threshold of matches to make a determination
  const MIN_THRESHOLD = 2;

  if (maxMatches < MIN_THRESHOLD) {
    return DELIVERY_TYPES.OTHER;
  }
  // Create an array of [type, matches] and find the first with maxMatches, or 'other'
  const types = [
    [DELIVERY_TYPES.AEM_EDGE, edsMatches],
    [DELIVERY_TYPES.AEM_CS, csMatches],
    [DELIVERY_TYPES.AEM_AMS, amsMatches],
    [DELIVERY_TYPES.AEM_HEADLESS, aemHeadlessMatches],
  ];
  const found = types.find(([, count]) => count === maxMatches);
  return found[0];
}
