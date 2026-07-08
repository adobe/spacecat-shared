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

import { createHash } from 'node:crypto';

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
 * The id is an OPAQUE, URL-safe token — `tag-` + the first 16 hex chars of `sha256(name)` — so it
 * survives use as a URL path segment (`PATCH /aio/tags/{tag_id}`) or query value
 * (`GET /aio/tags?parent_id=<id>`) with no encoding (adobe/spacecat-shared#1760). The prior
 * `tag-${encodeURIComponent(name)}` leaked the `%3A`/`%20` of a `category:Running Shoes` name into
 * the id, which then double-encoded / broke round-trips in HTTP consumers. It stays a pure function
 * of `name` (same name → same id), which is what lets `ops.tags.upsertMany` stay idempotent-by-name
 * and lets a prompt's embedded tag correlate with the standalone tag list. It does NOT survive a
 * rename (a renamed tag keeps its stored id, so `tagId(newName)` no longer matches) — id stability
 * across rename is explicitly out of scope for #1760.
 *
 * @param {string} name the tag name
 * @returns {string} the deterministic, URL-safe id (`tag-<first 16 hex of sha256(name)>`)
 */
export const tagId = (name) => `tag-${createHash('sha256').update(name).digest('hex').slice(0, 16)}`;
