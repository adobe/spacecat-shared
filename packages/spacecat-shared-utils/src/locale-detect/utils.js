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
import { iso6393 } from 'iso-639-3';
import worldCountries from 'world-countries';

export function parseLocale(locale) {
  let language;
  let region;

  // If it contains - or _, split into language and region
  if (locale.includes('-') || locale.includes('_')) {
    [language, region] = locale.toLowerCase().split(/[-_]/);
  } else {
    language = locale.toLowerCase();
  }

  // Validate language
  const lang = iso6393.find((l) => l.iso6393 === language || l.iso6391 === language);
  if (!lang) {
    language = null;
  } else {
    language = lang.iso6391;
  }

  // Validate region
  const country = worldCountries.find(
    (c) => c.cca2.toLowerCase() === region || c.cca3.toLowerCase() === region,
  );
  if (country) {
    region = country.cca2.toUpperCase();
  } else {
    region = null;
  }

  if (!language && !region) {
    return null;
  }

  const result = {};
  if (language) {
    result.language = language;
  }
  if (region) {
    result.region = region.toUpperCase();
  }
  return result;
}
