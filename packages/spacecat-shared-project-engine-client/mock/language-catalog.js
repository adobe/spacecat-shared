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

// @ts-check

/**
 * The canonical Project Engine language catalog — the single source of truth shared by the
 * `GET /v1/languages` route (which returns `{ id, name }`) and the project read-view factory
 * (which resolves a create request's `language_id` back to the ISO code the live read-view
 * carries). It is the FULL live catalog (38 languages, real UUIDs + English display names),
 * captured verbatim 2026-06-25 against the test workspace.
 *
 * Each row carries THREE values, because the live API uses two different names for a language in
 * two different views (confirmed live 2026-06-29):
 *  - `id`   — the Semrush catalog UUID. The consumer (`spacecat-api-service resolveLanguageId`)
 *             resolves an ISO code → English display `name` → this `id`, then sends it on create.
 *  - `name` — the English display name (e.g. "English"). This is what `GET /v1/languages` returns.
 *  - `iso`  — the ISO 639-1 code (e.g. "en"). This is what the PROJECT read-view returns as
 *             `settings.ai.language.name` — NOT the English display name. The consumer's `langOf`
 *             reads `settings.ai.language.name` directly as the slice language code, so a created
 *             project must echo the ISO code here for a market to round-trip (see {@link
 *             isoForLanguageId} and factories.js `createProjectResponseFromRequest`).
 *
 * Only `en` is live-verified as the read-view value (issue #1745); the other `iso` codes are the
 * conventional language codes for each language — ISO 639-1 where one exists, with two exceptions
 * (`zh-tw` is a BCP 47 tag for Chinese Traditional; `fil` is ISO 639-2/3 for Filipino, which has no
 * 639-1 code) — best-effort so any market a downstream IT exercises round-trips. Catalog `id` /
 * `name` are all live-captured.
 */

/**
 * The date the catalog (`id`/`name`) was captured verbatim from the live Semrush gateway, so drift
 * from the live taxonomy is discoverable/greppable rather than buried in prose. Bump it when the
 * catalog is re-captured.
 */
export const CATALOG_CAPTURED = '2026-06-25';

/**
 * @typedef {{ id: string, name: string, iso: string }} LanguageCatalogEntry
 */

/** @type {ReadonlyArray<LanguageCatalogEntry>} */
export const LANGUAGE_CATALOG = Object.freeze([
  { id: '76b01191-fa8b-4c1d-a71f-55ca8996669c', name: 'Afrikaans', iso: 'af' },
  { id: '7d3efff9-f6b6-4818-ac6b-0d1d2c047803', name: 'Arabic', iso: 'ar' },
  { id: 'cfcdee66-f9b3-4f39-9066-141b8de1a52d', name: 'Armenian', iso: 'hy' },
  { id: 'c5d84e73-66f9-4f17-989f-9a421d17cfe3', name: 'Azerbaijani', iso: 'az' },
  { id: 'ac1ace1e-22a1-40e9-b869-4fe2d0467603', name: 'Bulgarian', iso: 'bg' },
  { id: '728bef4c-94cf-4e14-bc06-56534751c71a', name: 'Chinese Simplified', iso: 'zh' },
  { id: '4fecf249-03fa-430a-b0b1-42421c5c1f7d', name: 'Chinese Traditional', iso: 'zh-tw' },
  { id: 'e64e7f7d-11d9-4830-a022-f370e0a74bf7', name: 'Czech', iso: 'cs' },
  { id: '4f407a00-600e-4bdc-bf18-e5d8c7f758e3', name: 'Danish', iso: 'da' },
  { id: '9090239f-5a3e-4101-a828-9bde09ad378b', name: 'Dutch', iso: 'nl' },
  { id: '5a0a33ed-7f5c-4901-befd-a042c0350da1', name: 'English', iso: 'en' },
  { id: 'f8b95d67-6ac5-48c2-9ed1-73b9e52d7f92', name: 'Filipino', iso: 'fil' },
  { id: '0a28a154-72ac-421c-86cf-1c4d240f3cda', name: 'Finnish', iso: 'fi' },
  { id: '471aba35-ee1f-4207-b6f6-8c6550bbbab8', name: 'French', iso: 'fr' },
  { id: '5227c7cd-4136-4fca-919c-42e666787319', name: 'Georgian', iso: 'ka' },
  { id: 'e5282ae9-83a6-4ea3-b3cf-5e99d8f51eca', name: 'German', iso: 'de' },
  { id: 'd7db513e-b5f6-4b11-9309-eda861451008', name: 'Greek', iso: 'el' },
  { id: 'a2c8acc6-be1f-47de-94aa-3c2587922922', name: 'Hebrew', iso: 'he' },
  { id: 'a3cd47fe-dc60-4cca-89e3-16984a1755af', name: 'Hindi', iso: 'hi' },
  { id: '495ccfcb-d61f-4544-9dc1-24d6393c9d18', name: 'Hungarian', iso: 'hu' },
  { id: 'd5376885-d3d8-4e6c-92ea-61d5ff9a7369', name: 'Indonesian', iso: 'id' },
  { id: '3ea61bf2-ebf4-40b5-8a59-900e701d966d', name: 'Italian', iso: 'it' },
  { id: '54bb0cca-b095-444b-be88-818a02e9beeb', name: 'Japanese', iso: 'ja' },
  { id: 'ad6bf224-42b0-46b6-b59a-21ea9d021fb8', name: 'Kazakh', iso: 'kk' },
  { id: 'c181d356-b65e-4ffa-b706-f61f96503d58', name: 'Korean', iso: 'ko' },
  { id: '1de63814-323e-4b2f-bd36-20fe15de14ae', name: 'Kurdish', iso: 'ku' },
  { id: '9bb46132-a85a-41c8-8d56-38bf5a050e76', name: 'Malay', iso: 'ms' },
  { id: 'a3b6e3f2-82f1-4b0b-8223-ae224d54bd63', name: 'Norwegian', iso: 'no' },
  { id: 'd53c0677-c451-46b2-9650-83dbca109f25', name: 'Polish', iso: 'pl' },
  { id: 'a4e931c1-22c8-45d4-897e-a653acbc8126', name: 'Portuguese', iso: 'pt' },
  { id: 'd64b3fb0-62eb-4d7e-947b-952194314b97', name: 'Romanian', iso: 'ro' },
  { id: '19933246-6952-4929-ad0d-6cee874ea553', name: 'Russian', iso: 'ru' },
  { id: '6abdf315-f969-4643-894f-aefabe7ed057', name: 'Slovak', iso: 'sk' },
  { id: '29047b68-fe6f-4525-8ef7-8b1c2349af5d', name: 'Spanish', iso: 'es' },
  { id: '5c400ede-f822-402e-be32-4a88049e74e4', name: 'Swedish', iso: 'sv' },
  { id: 'b8208c02-3e73-433b-b6c2-2784d0ba9bfa', name: 'Thai', iso: 'th' },
  { id: '71630579-fd14-4357-81b3-0ae4ecd54975', name: 'Turkish', iso: 'tr' },
  { id: '12aa4de5-3526-4b96-909a-c033c1f4e32c', name: 'Vietnamese', iso: 'vi' },
]);

/** Reverse index: catalog UUID → ISO 639-1 code. */
const ISO_BY_ID = new Map(LANGUAGE_CATALOG.map((l) => [l.id, l.iso]));

/**
 * Resolves a catalog language UUID (what a create request sends as `language_id`) to the ISO code
 * the live project read-view returns as `settings.ai.language.name`. Returns `''` for an empty or
 * unknown id, mirroring the create factory's other empty defaults.
 * @param {string} [id] the catalog language UUID
 * @returns {string} the ISO 639-1 code, or `''` when the id is empty/unknown
 */
export function isoForLanguageId(id) {
  return (id && ISO_BY_ID.get(id)) || '';
}
