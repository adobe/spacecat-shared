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

const siteCompetitors = [
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440000',
    baseURL: 'https://competitor1.com',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440001',
    baseURL: 'https://competitor2.com',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440002',
    baseURL: 'https://competitor3.com',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440003',
    baseURL: 'https://competitor4.com',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440004',
    baseURL: 'https://competitor5.com',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440005',
    baseURL: 'https://competitor6.com',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440006',
    baseURL: 'https://competitor7.com',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440007',
    baseURL: 'https://competitor8.com',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440008',
    baseURL: 'https://competitor9.com',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440009',
    baseURL: 'https://competitor10.com',
    siteId: 'b1ec63c4-87de-4500-bbc9-276039e4bc10',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440010',
    baseURL: 'https://competitor11.com',
    siteId: 'b1ec63c4-87de-4500-bbc9-276039e4bc10',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440011',
    baseURL: 'https://competitor12.com',
    siteId: 'b1ec63c4-87de-4500-bbc9-276039e4bc10',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440012',
    baseURL: 'https://competitor13.com',
    siteId: 'b1ec63c4-87de-4500-bbc9-276039e4bc10',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440013',
    baseURL: 'https://competitor14.com',
    siteId: 'b1ec63c4-87de-4500-bbc9-276039e4bc10',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440014',
    baseURL: 'https://competitor15.com',
    siteId: 'b1ec63c4-87de-4500-bbc9-276039e4bc10',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440015',
    baseURL: 'https://competitor16.com',
    siteId: 'b1ec63c4-87de-4500-bbc9-276039e4bc10',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440016',
    baseURL: 'https://competitor17.com',
    siteId: 'b1ec63c4-87de-4500-bbc9-276039e4bc10',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    siteCompetitorId: '550e8400-e29b-41d4-a716-446655440017',
    baseURL: 'https://competitor18.com',
    siteId: 'b1ec63c4-87de-4500-bbc9-276039e4bc10',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default siteCompetitors;
