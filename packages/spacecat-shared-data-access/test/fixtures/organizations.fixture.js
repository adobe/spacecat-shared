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

const organizations = [
  {
    id: '643f4cda-fb22-47af-909f-6ad627f6eca1',
    name: 'Example 1 Organization',
    imsOrgId: 'default',
    createdAt: Date.parse('2024-03-09T08:37:30.408Z'),
    updatedAt: Date.parse('2024-03-10T08:00:12.513Z'),
    config:
      {
        slack:
          {
            channel: 'some-slack-channel',
          },
        handlers:
          {
            404:
              {
                mentions:
                  {
                    slack:
                      [],
                  },
              },
            'broken-backlinks':
              {
                mentions:
                  {
                    slack:
                      [],
                  },
              },
          },
        imports:
          [],
      },
  },
];

export default organizations;
