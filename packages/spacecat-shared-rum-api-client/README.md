# Spacecat Shared - RUM API Client

A JavaScript client for Adobe's Real User Monitoring (RUM) API, part of the SpaceCat Shared library.

## Installation

Install the package using npm:

```bash
npm install @adobe/spacecat-shared-rum-api-client
```

## Usage

#### Creating and instance from Helix UniversalContext

```js
const context = {}; // Your AWS Lambda context object
const rumApiClient = RUMAPIClient.createFrom(context);

```

#### From constructor

```js
const rumApiClient = new RUMAPIClient();
```

### Running a query

```js
const opts = {
  domain: 'www.aem.live',
  domainkey: '<domain-key>',
  granularity: 'hourly',
  interval: 10
}

const result = await rumApiClient.query('cwv', opts);
console.log(`Query result: ${result}`)
```

**Note**: all queries must be lowercase

### Query Options: the 'opts' object

| option      | required | default | remarks             |
|-------------|----------|---------|---------------------|
| domain      | yes      |         |                     |
| domainkey   | yes      |         |                     |
| interval    | no       | 7       | days in integer     |
| granularity | no       | daily   | 'daily' or 'hourly' |

## Available queries

### cwv

Calculates the CWV data for a given domain within the requested interval. It gets the 
P75 values for LCP, CLS, INP, TTFB metrics, along with the number of data points available for
each metric. Additionally, it provides grouping by URL and includes the count of page view data.

An example response:

```json
[
  {
    "url": "https://www.aem.live/home",
    "pageviews": 2620,
    "lcp": 2099.699999988079,
    "lcpCount": 9,
    "cls": 0.020660136604802475,
    "clsCount": 7,
    "inp": 12,
    "inpCount": 3,
    "ttfb": 520.4500000476837,
    "ttfbCount": 18
  },
  {
    "url": "https://www.aem.live/developer/block-collection",
    "pageviews": 2000,
    "lcp": 512.1249999403954,
    "lcpCount": 4,
    "cls": 0.0005409526209424976,
    "clsCount": 4,
    "inp": 20,
    "inpCount": 2,
    "ttfb": 122.90000003576279,
    "ttfbCount": 4
  }
]
```
### 404

Calculates the number of 404 errors for a specified domain within the requested interval. The results 
are grouped by URL and the source of the 404 error. The output includes all the various sources that 
direct traffic to the 404 page, as well as the total number of views originating from these sources.

An example response:

```json
[
  {
    "url": "https://www.aem.live/developer/tutorial",
    "views": 400,
    "all_sources": [
      "https://www.google.com",
      "",
      "https://www.instagram.com"
    ],
    "source_count": 3,
    "top_source": "https://www.google.com"
  },
  {
    "url": "https://www.aem.live/some-other-page",
    "views": 300,
    "all_sources": [
      "https://www.bing.com",
      ""
    ],
    "source_count": 2,
    "top_source": ""
  },
  {
    "url": "https://www.aem.live/developer/",
    "views": 100,
    "all_sources": [
      ""
    ],
    "source_count": 1,
    "top_source": ""
  }
]

```

### experiment

Lists all the experiments for a specified domain within the requested interval. The results are grouped by URL. The output includes all the URLs running the experiment, along with experiment id, variants, number of clicks/convert/formsubmit events per variant/selector and views for each of the variant in the experiment.


An example response:

```json
{
  "https://www.aem.live/home": [
    {
      "experiment": "short-home",
      "variants": [
        {
          "name": "challenger-1",
          "views": 1300,
          "click": {
            ".hero": 100,
            ".header #navmenu-0": 100,
            ".roi-calculator .button": 100,
            ".hero .button": 100
          },
          "convert": {},
          "formsubmit": {}
        },
        {
          "name": "control",
          "views": 800,
          "click": {
            ".hero .button": 100,
            ".header .button": 200,
            ".header #navmenu-0": 200
          },
          "convert": {},
          "formsubmit": {}
        }
      ]
    }
  ],

  "https://www.aem.live/new-exp-page": [
    {
      "experiment": "visitor-behavior",
      "variants": [
        {
          "name": "https://www.aem.live/some-other-page",
          "views": 500,
          "click": {},
          "convert": {},
          "formsubmit": {}
        }
      ]
    }
  ]
}

```

## Linting
Lint the codebase using:
```
npm run lint
```

## Cleaning
To clean the package (remove `node_modules` and `package-lock.json`):
```
npm run clean
```

## Repository
Find the source code and contribute [here](https://github.com/adobe/spacecat-shared.git).

## Issues
Report issues or bugs [here](https://github.com/adobe/spacecat-shared/issues).

## License
This project is licensed under the Apache-2.0 License.
