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

import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";

/**
 * @class AWSCostApiClient
 * @description AWS Cost Explorer API client
 * @param {Object} context - The context object
 * 
 */
export default class AWSCostApiClient {
  static createFrom(context) {
    if(context.cogsApiClient) return context.cogsApiClient;
    const client = new AWSCostApiClient(context);
    context.cogsApiClient = client;
    return client;
  }

  constructor(context) {
    this.log = context.log || console;
    this.region = context.region || process.env.AWS_REGION || "us-east-1";
    this.client = new CostExplorerClient(
    {
      region,
      credentials: {
        accessKeyId: context.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: context.env.AWS_SECRET_ACCESS_KEY,
      }
    });
  }
  /**
   * 
   * @param {GetCostAndUsageRequest} input 
   * @returns {GetCostAndUsageResponse}
   */
  async getUsageCost(input) {
    const command = new GetCostAndUsageCommand(input);
    return await client.send(command);    
  }
}
