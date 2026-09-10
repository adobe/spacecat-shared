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

import type { BaseCollection, BaseModel } from '../base';

export interface OaeValidation extends BaseModel {
    getJobId(): string;
    getSuggestionId(): string;
    getStatus(): string;
    getType(): string;
    getOutcome(): string | undefined;
    getCompletedAt(): string | undefined;
    getMetadata(): object | undefined;
    setJobId(jobId: string): void;
    setSuggestionId(suggestionId: string): void;
    setStatus(status: string): void;
    setType(type: string): void;
    setOutcome(outcome: string): void;
    setCompletedAt(completedAt: string): void;
    setMetadata(metadata: object): void;
}

export interface OaeValidationCollection extends BaseCollection<OaeValidation> {
    allByJobId(jobId: string): Promise<OaeValidation[]>;
}
