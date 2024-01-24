# Spacecat Shared - AWS CostUsage API Client

A javascript client to access AWS Cost Usage by using `@aws-sdk/client-cost-explorer` library, part of teh Spacecat Shared Library.

## Installation
```bash
npm install @adobe/spacecat-shared-aws-costusage-client
```

## Usage

### Creating an instance from Helix UniversalContext

```js
const context = {};
const client = new AWSCostApiClient.createFrom(context);
```

### Constructor

`AwAWSCostApiClient` class needs AWS region and credentials to be able to access the AWS Cost Usage API. The credentials can be passed as an object or as a function that returns a promise.

```js
const client = new AWSCostApiClient(context);

```

### getCostAndUsage

```js
const costAndUsage = await client.getCostAndUsage({
  TimePeriod: {
    Start: '2021-01-01',
    End: '2021-01-31',
  },
  Granularity: 'MONTHLY',
  Metrics: ['BlendedCost'],
  GroupBy: [
    {
      Type: 'DIMENSION',
      Key: 'SERVICE',
    },
  ],
  Filter: {
    And: [
      {
        Dimensions: {
          Key: 'SERVICE',
          Values: ['Amazon Elastic Compute Cloud - Compute'],
        },
      },
      {
        Dimensions: {
          Key: 'USAGE_TYPE_GROUP',
          Values: ['EC2: Running Hours'],
        },
      },
    ],
  },
});
```
