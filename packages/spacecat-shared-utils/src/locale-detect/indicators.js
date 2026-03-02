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

import worldCountries from 'world-countries';
import { franc } from 'franc-min';

import { parseLocale } from './utils.js';

export function checkTld({ baseUrl }) {
  const hostnameParts = baseUrl.hostname.split('.');
  if (hostnameParts.length < 2) {
    return [];
  }
  let tld = hostnameParts.pop();
  tld = `.${tld.toLowerCase()}`;

  const country = worldCountries.find((c) => c.tld.includes(tld));
  if (!country) {
    return [];
  }
  return [{
    region: country.cca2.toUpperCase(),
    type: 'tld',
  }];
}

export function checkSubdomain({ baseUrl }) {
  const hostnameParts = baseUrl.hostname.split('.');
  if (hostnameParts.length < 3) {
    return [];
  }
  const subdomain = hostnameParts[0];
  if (!subdomain || subdomain === 'www' || subdomain.length < 2 || subdomain.length > 3) {
    return [];
  }
  // We don't know if subdomain is language or region, try use as both
  const locale = parseLocale(`${subdomain}_${subdomain}`);
  if (locale) {
    return [{ ...locale, type: 'subdomain' }];
  }
  return [];
}

export function checkPath({ baseUrl }) {
  // Remove any file extension
  const path = baseUrl.pathname.replace(/\.[^/.]+$/, '');

  if (!path || path === '/') {
    return [];
  }

  // Check for BCP 47 segment
  const bcp47Segment = path
    .split('/')
    .find((s) => s.length === 5 && (s.includes('-') || s.includes('_')));
  if (bcp47Segment) {
    const locale = parseLocale(bcp47Segment);
    if (locale) {
      return [{ ...locale, type: 'path' }];
    }
  }

  // Get all segments of length 2 or 3
  let segments = path.split('/')
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length === 2 || s.length === 3);

  if (segments.length === 0) {
    return [];
  }

  // If there are more than two segments, only consider the first two
  if (segments.length > 2) {
    segments = segments.slice(0, 2);
  }

  // If two segments, reverse them as we assume they are region and language
  if (segments.length === 2) {
    segments = segments.reverse();
  }

  const locale = parseLocale(segments.join('_'));
  if (locale) {
    return [{ ...locale, type: 'path' }];
  }
  return [];
}

export function checkHeaders({ headers }) {
  const indicators = [];

  const headerKeys = ['content-language', 'x-content-language'];

  for (const headerKey of headerKeys) {
    if (headers[headerKey]) {
      const values = headers[headerKey].split(',').map((v) => v.trim());
      for (const value of values) {
        const locale = parseLocale(value);
        if (locale) {
          indicators.push({ ...locale, type: 'header' });
        }
      }
    }
  }

  return indicators;
}

export function checkHtmlLang({ $ }) {
  const lang = $('html').attr('lang');
  if (!lang) {
    return [];
  }
  const locale = parseLocale(lang);
  if (locale) {
    return [{ ...locale, type: 'html' }];
  }
  return [];
}

export function checkMetaTags({ $ }) {
  const indicators = [];

  const metaTagSelectors = ['meta[http-equiv="content-language"]', 'meta[property="og:locale"]'];

  for (const metaTagSelector of metaTagSelectors) {
    const metaTag = $(metaTagSelector);
    if (metaTag && metaTag.length > 0) {
      const content = metaTag.attr('content');
      if (!content) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const values = metaTag.attr('content').split(',').map((v) => v.trim());
      for (const value of values) {
        const locale = parseLocale(value);
        if (locale) {
          indicators.push({ ...locale, type: 'metaTag' });
        }
      }
    }
  }

  return indicators;
}

export function checkHrefLang({ baseUrl, $ }) {
  const linkTags = $('link[hreflang]');
  const matchingLinkTag = Array.from(linkTags).find((element) => {
    const elementHref = new URL($(element).attr('href'));
    if (!`${elementHref.hostname}${elementHref.pathname}`.includes(`${baseUrl.hostname}${baseUrl.pathname}`)) {
      return false;
    }
    if ($(element).attr('hreflang').includes('default')) {
      return false;
    }
    return true;
  });
  if (!matchingLinkTag) {
    return [];
  }
  const locale = parseLocale($(matchingLinkTag).attr('hreflang'));
  if (locale) {
    return [{ ...locale, type: 'hreflang' }];
  }
  return [];
}

export function checkContentLanguage({ $ }) {
  const metaDescription = $('meta[name="description"]').attr('content');
  if (!metaDescription) {
    return [];
  }
  const language = franc(metaDescription);
  const locale = parseLocale(language);
  if (locale) {
    return [{ ...locale, type: 'content' }];
  }
  return [];
}

// Export all indicators as array
export const indicators = [
  checkTld,
  checkSubdomain,
  checkPath,
  checkHeaders,
  checkHtmlLang,
  checkMetaTags,
  checkHrefLang,
  checkContentLanguage,
];
