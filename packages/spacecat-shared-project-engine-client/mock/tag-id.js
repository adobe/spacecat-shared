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
 * Separates the parent id from the name in the hash preimage. A byte that cannot occur in either
 * makes the encoding unambiguous: without it, `(parent: 'ab', name: '')` and `(parent: 'a',
 * name: 'b')` would hash the same preimage and collide.
 */
const SEPARATOR = '\u0000';

/**
 * The deterministic tag id derived from a tag's `(parent, name)` pair — the single source of truth
 * shared by the two routes that mint tag ids: `POST /aio/tags` (which persists a standalone project
 * tag with this id) and `POST /aio/prompts/tagged` (which embeds the same id in each prompt's tag
 * map). Because both routes derive the id the same way, a tag registered standalone and the same
 * tag attached to a prompt resolve to ONE id, so `by_tags` filtering and the Categories surface
 * correlate them. Exposed on the per-request context as `context.tagId` (every route reads its lib
 * helpers through `$.context`, never an import — see {@link Context}), so the contract lives in one
 * place and the two handlers can't drift.
 *
 * **The parent is part of the key because live uniqueness is per `(project, parent)`, not per
 * name.** Under the dimension-root tag model every value is a bare-named descendant, so two
 * sub-categories named `Pricing` under different categories are two distinct tags. Keying the id on
 * the name alone would collapse them onto one row and silently corrupt any consumer that trusts the
 * mock — which is exactly what the api-service integration suite does.
 *
 * The id is an OPAQUE, URL-safe token — `tag-` + the first 16 hex chars of
 * `sha256(parentId + NUL + name)` — so it survives use as a URL path segment
 * (`PATCH /aio/tags/{tag_id}`) or query value (`GET /aio/tags?parent_id=<id>`) with no encoding
 * (adobe/spacecat-shared#1760).
 *
 * It does NOT survive a rename or a re-parent: a patched tag keeps its stored id, so
 * `tagId(newName, newParent)` no longer matches it. Id stability across `PATCH` is explicitly out
 * of scope — the live ids are opaque and equally unrecoverable from the current name.
 *
 * `POST /aio/prompts/tagged` carries only names, with no channel for a parent, so it can address
 * ROOTS only — it calls this with `parentId` omitted. That is a faithful model of the live
 * endpoint, not a mock shortcut: see the route's header comment.
 *
 * @param {string} name the tag name (bare — under the dimension-root model no name carries a `:`)
 * @param {string} [parentId] the parent tag's id; omitted / empty ⇒ a root tag
 * @returns {string} the deterministic, URL-safe id (`tag-<16 hex of sha256(parent NUL name)>`)
 */
export const tagId = (name, parentId = '') => `tag-${createHash('sha256')
  .update(`${parentId}${SEPARATOR}${name}`)
  .digest('hex')
  .slice(0, 16)}`;
