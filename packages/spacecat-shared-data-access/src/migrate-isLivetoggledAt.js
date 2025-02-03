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
import { isIsoDate } from '@adobe/spacecat-shared-utils';
import { getDataAccess, getDynamoClients } from '../test/it/util/db.js';

const config = {
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
};
const srcDataAccess = await getDataAccess(config);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockDataAccess = await getDataAccess({
  endpoint: 'http://127.0.0.1:8000',
  region: 'local',
  credentials: {
    accessKeyId: 'o71baq',
    secretAccessKey: 'lz7fu',
  },
});
const { docClient } = getDynamoClients(config);

const originalSites = await srcDataAccess.Site.all();

for (const site of originalSites) {
  // eslint-disable-next-line no-await-in-loop
  const params = {
    TableName: 'spacecat-services-sites-dev',
    IndexName: 'spacecat-services-all-sites-dev',
    KeyConditionExpression: 'GSI1PK = :gsi1pk AND baseURL = :baseURL',
    ExpressionAttributeValues: {
      ':gsi1pk': 'ALL_SITES',
      ':baseURL': site.getBaseURL(),
    },
    Limit: 1,
  };

  try {
    // Directly await the promise returned by query
    // eslint-disable-next-line no-await-in-loop
    const originalSite = (await docClient.query(params))?.Items?.[0];
    console.log('Query succeeded.');
    console.log(originalSite);
    if (!originalSite) {
      // eslint-disable-next-line no-continue
      console.log('Site not found:', site.getBaseURL());
      // eslint-disable-next-line no-continue
      continue;
    }
    const liveToggledAt = originalSite.isLiveToggledAt;

    if (liveToggledAt && isIsoDate(liveToggledAt)) {
      site.setIsLiveToggledAt(liveToggledAt);
    } else {
      site.setIsLiveToggledAt(undefined);
    }
    // eslint-disable-next-line no-await-in-loop
    const entity = await site.save();
    console.log('Updated site:', entity.getIsLiveToggledAt());
  } catch (err) {
    console.error('Unable to query. Error:', JSON.stringify(err, null, 2));
  }
}
