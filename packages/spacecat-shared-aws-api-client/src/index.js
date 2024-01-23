/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";

function calculatePreviousMonthDate() {
  const date = new Date();
  let month = 1 + date.getMonth(); // as month starts from 0
  let year = date.getFullYear();
  const endDate = `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/01`;
  if (month === 1) { // if month is january then previous month will be december of previous year
    month = 12;
    year -= 1;
  }
  else {
    month -= 1;
  }
  const startDate = `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/01`;
  return { startDate, endDate };
}
const { startDate, endDate } = calculatePreviousMonthDate();
const input = {
  "TimePeriod": {
    "End": endDate,
    "Start": startDate
  },
  "Granularity": "MONTHLY",
  "Filter": {
    "Tags": {
      "Key": 'Adobe.ArchPath',
      "Values": ['EC.SpaceCat.Services'],
      "MatchOptions": ['EQUALS']
    }
  },
  "Metrics": [
    "UnblendedCost"
  ],
  "GroupBy": [
    {
      "Key": "SERVICE",
      "Type": "DIMENSION"
    },
    {
      "Key": "Environment",
      "Type": "TAG"
    }
  ]
};

export default class AWSCostApiClient {
  static createFrom(context) {
    if(context.cogsApiClient) return context.cogsApiClient;
    const client = new CostExplorerClient({ region });
    context.cogsApiClient = client;
    return client;
  }
  constructor(context) {

    const client = new CostExplorerClient({ region });
  }
  async getUsageCost() {
    const command = new GetCostAndUsageCommand(input);
    return await client.send(command);
  }
}
