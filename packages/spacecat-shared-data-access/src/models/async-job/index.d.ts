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

import type { BaseCollection, BaseModel } from '../base';

// Note on nullable return types: `postgrest.utils.js::normalizeModelValue()`
// maps DB NULL → JS `undefined` (the key is skipped on `this.record`
// entirely), so auto-generated getters return `T | undefined` — never
// `T | null` — for nullable columns. Callers checking `=== null` on these
// will silently miss the unfinished-job branch. Existing declarations
// that read `... | null` predate this PR; the lifecycle additions below
// match the runtime contract.
export interface AsyncJob extends BaseModel {
    getStatus(): string;
    getResultLocation(): string;
    getResultType(): string;
    getResult(): object | [];
    getError(): { code: string; message: string; details?: object } | null;
    getMetadata(): object | null;
    getRecordExpiressAt(): number;
    getStartedAt(): string | undefined;
    getEndedAt(): string | undefined;
    setStatus(status: string): void;
    setResultLocation(location: string): void;
    setResultType(type: string): void;
    setResult(result: object | []): void;
    setError(error: { code: string; message: string; details?: object }): void;
    setMetadata(metadata: object): void;
    setExpiresAt(expiresAt: number): void;
    setStartedAt(startedAt: string): void;
    setEndedAt(endedAt: string): void;
}

export interface AsyncJobCollection extends BaseCollection<AsyncJob> {
    allByStatus(status: string): Promise<AsyncJob[]>;
    findByStatus(status: string): Promise<AsyncJob | null>;
}
