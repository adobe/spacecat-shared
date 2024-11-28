/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

const sites = [
  {
    id: '4af16428-d0df-4987-9975-dc1ce6e9e217',
    baseURL: 'https://example1.com',
    hlxConfig:
      {
        hlxVersion: 5,
        code:
          {
            owner: 'hlxsites',
            repo: 'example1',
            source:
              {
                type: 'github',
                url: 'https://github.com/some-owner/example1',
              },
          },
        cdn:
          {
            prod:
              {
                host: 'www.example1.com',
                zoneId: 'some-zone-id',
                apiToken: 'some-api-token',
                type: 'some-cdn',
                plan: 'some-plan',
              },
          },
        content:
          {
            contentBusId: 'some-contentbus-id',
            source:
              {
                type: 'onedrive',
                url: 'https://some-provider/files/website',
              },
          },
        rso:
          {
            owner: 'some-owner',
            ref: 'main',
            site: 'example1',
            tld: 'aem.live',
          },
      },
    deliveryType: 'aem_edge',
    gitHubURL: 'https://github.com/some-owner/example1',
    organizationId: '643f4cda-fb22-47af-909f-6ad627f6eca1',
    isLive: true,
    // isLiveToggledAt: Date.parse('2024-03-09T08:37:30.408Z'),
    createdAt: Date.parse('2023-09-08T13:10:19.801Z'),
    updatedAt: Date.parse('2024-07-06T18:39:30.873Z'),
    config:
      {
        slack:
          {
            channel: 'some-channel-id',
          },
        handlers:
          {
            404:
              {
                mentions:
                  {
                    slack:
                      [
                        '<@some-user-id>',
                      ],
                  },
              },
            'broken-backlinks':
              {
                excludedURLs:
                  [],
                manualOverwrites:
                  [],
                fixedURLs:
                  [],
                mentions:
                  {
                    slack:
                      [
                        '<@some-user-id>',
                      ],
                  },
              },
          },
        imports:
          [
            {
              sources:
                [
                  'google',
                ],
              type: 'top-pages',
              destinations:
                [
                  'default',
                ],
            },
            {
              sources:
                [
                  'google',
                ],
              type: 'organic-traffic',
              destinations:
                [
                  'default',
                ],
            },
          ],
      },
  },
];

export default sites;
