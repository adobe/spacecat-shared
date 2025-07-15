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
import { getStaticContent } from '@adobe/spacecat-shared-utils';

const TRAFIC_ANALYSIS_PATH = 'static/queries/traffic-analysis.sql.tpl';

/**
 * Loads the traffic analysis query template and applies placeholders.
 * @param {Object} placeholders - Key-value pairs to replace in the query template.
 * @param {Object} log - Logger (optional)
 * @returns {Promise<string|null>} The templated SQL string or null on error.
 */
export async function getTrafficAnalysisQuery(placeholders = {}, log = console) {
  try {
    // getStaticContent expects the filename relative to the static/ directory
    return await getStaticContent(placeholders, TRAFIC_ANALYSIS_PATH);
  } catch (err) {
    log.error('Error loading traffic analysis query:', err.message);
    return null;
  }
}

/**
 * Scans the query template and returns a sorted array of unique placeholder (strings).
 * @returns {Promise<string[]>} Array of unique placeholder keys found in the template.
 */
export async function getTrafficAnalysisQueryPlaceholders(log = console) {
  try {
    // Load the raw template with no replacements
    const raw = await getStaticContent({}, TRAFIC_ANALYSIS_PATH);
    const matches = raw ? raw.match(/{{\s*([\w]+)\s*}}/g) : [];
    return [...new Set((matches || []).map((m) => m.replace(/{{\s*|\s*}}/g, '')))].sort();
  } catch (err) {
    log.error('Error extracting placeholders from traffic analysis query:', err.message);
    return [];
  }
}
