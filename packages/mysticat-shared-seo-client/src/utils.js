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

/**
 * Maps SEO API response header names back to their column codes.
 * The API returns full names in headers even when requested by code.
 */
const HEADER_TO_CODE = {
  Domain: 'Dn',
  Rank: 'Rk',
  'Organic Keywords': 'Or',
  'Organic Traffic': 'Ot',
  'Organic Cost': 'Oc',
  'Adwords Keywords': 'Ad',
  'Adwords Traffic': 'At',
  'Adwords Cost': 'Ac',
  Date: 'Dt',
  Keyword: 'Ph',
  Position: 'Po',
  'Previous Position': 'Pp',
  'Search Volume': 'Nq',
  CPC: 'Cp',
  Url: 'Ur',
  URL: 'Ur',
  Traffic: 'Tg',
  'Traffic (%)': 'Tr',
  'Traffic Cost (%)': 'Tc',
  Competition: 'Co',
  'Number of Results': 'Nr',
  Trends: 'Td',
  'Keyword Difficulty': 'Kd',
  'SERP Features': 'Fp',
  'SERP Features by Position': 'Fp',
  'Keywords SERP Features': 'Fk',
  'SERP Features by Keyword': 'Fk',
  Timestamp: 'Ts',
  Intents: 'In',
  Branded: 'Br',
  Title: 'Tt',
  Description: 'Ds',
  'Visible Url': 'Vu',
  'Number of Keywords': 'Pc',
};

/**
 * Normalizes a CSV header to its column code.
 * If already a known code or not in the map, returns as-is.
 */
function normalizeHeader(header) {
  return HEADER_TO_CODE[header] || header;
}

/**
 * Parses semicolon-delimited CSV text into an array of objects.
 * First row is treated as headers. Handles double-quoted fields (export_escape=1).
 * Headers are normalized to column codes via HEADER_TO_CODE map.
 * @param {string} text - Raw CSV response body
 * @returns {object[]} Array of row objects keyed by column codes
 */
export function parseCsvResponse(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(';').map((h) => normalizeHeader(h.replace(/^"|"$/g, '').trim()));
  return lines.slice(1).map((line) => {
    const values = line.split(';');
    return Object.fromEntries(
      headers.map((h, i) => [h, (values[i] ?? '').replace(/^"|"$/g, '').trim()]),
    );
  });
}

/**
 * Coerces a string CSV value to the appropriate JS type.
 * @param {string} value - Raw string from CSV
 * @param {'int'|'float'|'string'|'bool'} type - Target type
 * @returns {*} Coerced value
 */
export function coerceValue(value, type) {
  if (value === '' || value === undefined || value === null) return null;
  switch (type) {
    case 'int': {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
    case 'float': {
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    case 'bool':
      return value === 'true' || value === '1' || value === 'True';
    default:
      return value;
  }
}

/**
 * Enforces an upper bound on a limit value.
 * @param {number} limit
 * @param {number} upperLimit
 * @returns {number}
 */
export const getLimit = (limit, upperLimit) => Math.min(limit, upperLimit);

/**
 * Converts YYYY-MM-DD to YYYYMM15 format used by the SEO API for monthly data.
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @returns {string} Date in YYYYMM15 format
 */
export function toApiDate(date) {
  return `${date.slice(0, 4)}${date.slice(5, 7)}15`;
}

/**
 * Returns today's date as YYYY-MM-DD.
 * @returns {string}
 */
export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Converts a YYYYMMDD date string from the API to YYYY-MM-DD.
 * @param {string} apiDate - Date in YYYYMMDD format
 * @returns {string} Date in YYYY-MM-DD format
 */
export function fromApiDate(apiDate) {
  if (!apiDate || apiDate.length < 8) return apiDate;
  return `${apiDate.slice(0, 4)}-${apiDate.slice(4, 6)}-${apiDate.slice(6, 8)}`;
}

/**
 * Builds a SEO API display_filter string from an array of filter descriptors.
 * @param {Array<{sign: string, field: string, op: string, value: string}>} filters
 * @returns {string} Pipe-delimited filter string
 */
export function buildFilter(filters) {
  return filters
    .map(({
      sign, field, op, value,
    }) => `${sign}|${field}|${op}|${value}`)
    .join('|');
}

/**
 * Extracts a brand name from a domain for client-side branded keyword detection.
 * E.g., "adobe.com" → "adobe", "www.example.co.uk" → "example"
 * @param {string} domain
 * @returns {string} Lowercase brand name
 */
export function extractBrand(domain) {
  const cleaned = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
  const parts = cleaned.split('.');
  return (parts[0] || '').toLowerCase();
}

/**
 * Merges default query parameters with caller-provided overrides.
 * @param {object} defaults - Default parameter values
 * @param {object} overrides - Caller-provided overrides
 * @returns {object} Merged parameters
 */
export function buildQueryParams(defaults, overrides) {
  return { ...defaults, ...overrides };
}
