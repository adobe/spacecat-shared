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

/* eslint-env mocha */
import chai from 'chai';


// eslint-disable-next-line import/no-named-default
import { AWSCostApiClient } from '../src/index.js';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('run aws api client', () => {
  afterEach('clean each', () => {
    nock.cleanAll();
  });
  it('does not create a new instance if previously initialized', async () => {
    const awsCostApiClient = AWSCostApiClient.createFrom({ log: console, region: 'us-east-1' });
    expect(awsCostApiClient).to.be.an.instanceof(AWSCostApiClient);
  });
  it('verify input', async () => {
    const awsCostApiClient = AWSCostApiClient.createFrom({ log: console, region: 'us-east-1' });
    const input = {
      TimePeriod: {
        Start: '2021-01-01',
        End: '2021-01-31',
      },
      Granularity: 'MONTHLY',
      Filter: {
        And: [
          {
            Dimensions: {
              Key: 'SERVICE',
              Values: [
                'Amazon Simple Storage Service',
              ],
            },
          },
          {
            Dimensions: {
              Key: 'USAGE_TYPE_GROUP',
              Values: [
                'Storage',
              ],
            },
          },
        ],
      },
      Metrics: [
        'AmortizedCost',
      ],
    };
    response = awsCostApiClient.getUsageCost(input);
    const response = {
      ResultsByTime: [
        {
          TimePeriod: {
            Start: '2021-01-01',
            End: '2021-02-01',
          },
          Total: {
            AmortizedCost: {
              Amount: '0.0000000000',
              Unit: 'USD',
            },
          },
        },
      ],
      GroupDefinitions: [],
    };
  });
});
