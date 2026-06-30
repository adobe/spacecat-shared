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
 * The deterministic tag id derived from a tag name — the single source of truth shared by the two
 * routes that mint tag ids: `POST /aio/tags` (which persists a standalone project tag with this id)
 * and `POST /aio/prompts/tagged` (which embeds the same id in each prompt's tag map). Because both
 * routes derive the id the same way, a category registered standalone and the same category
 * attached to a prompt resolve to ONE id, so `by_tags` filtering and the Categories surface
 * correlate them. Exposed on the per-request context as `context.tagId` (every route reads its lib
 * helpers through `$.context`, never an import — see {@link Context}), so the contract lives in one
 * place and the two handlers can't drift.
 *
 * @param {string} name the tag name
 * @returns {string} the deterministic id (`tag-<url-encoded name>`)
 */
export const tagId = (name) => `tag-${encodeURIComponent(name)}`;
