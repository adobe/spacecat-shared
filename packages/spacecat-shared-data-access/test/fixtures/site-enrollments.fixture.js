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

const siteEnrollments = [
  {
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52',
    siteEnrollmentId: '0e07949e-8845-4fac-b903-24a42c5533b9',
    entitlementId: '3fe5ca60-4850-431c-97b3-f88a80f07e9b',
    config: {
      feature1: 'enabled',
      theme: 'dark',
    },
  },
  {
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    siteEnrollmentId: '33b54915-e58e-455d-b644-aefd846acab0',
    entitlementId: '48656b02-62cb-46c0-b271-ee99c940e89e',
    config: {
      feature2: 'disabled',
      region: 'us-east-1',
    },
  },
  {
    siteId: '56a691db-d32e-4308-ac99-a21de0580557',
    siteEnrollmentId: 'a2ebd21f-c7ec-4876-9662-82e644fe0edd',
    entitlementId: '5bc610a9-bc59-48d8-937e-4808ade2ecb1',
    config: {},
  },
];

export default siteEnrollments;
