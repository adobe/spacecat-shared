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

const consumers = [
  {
    consumerId: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    clientId: 'client-123-abc',
    consumerName: 'consumer-456-def',
    status: 'ACTIVE',
    capabilities: ['read', 'write', 'delete'],
    issuerId: '908936ED5D35CC220A495CD4@AdobeOrg',
  },
  {
    consumerId: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
    clientId: 'client-789-ghi',
    consumerName: 'consumer-012-jkl',
    status: 'SUSPEND',
    capabilities: ['read'],
    issuerId: '8C6043F15F43B6390A49401A@AdobeOrg',
  },
  {
    consumerId: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
    clientId: 'client-123-abc',
    consumerName: 'consumer-345-mno',
    status: 'ACTIVE',
    capabilities: ['read', 'write'],
    issuerId: '908936ED5D35CC220A495CD4@AdobeOrg',
  },
];

export default consumers;
