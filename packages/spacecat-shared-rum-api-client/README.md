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

### Core Web Vitals (CWV)

Calculates the CWV data for a given domain within the requested interval. It retrieves the P75 
values for **LCP**, **CLS**, **INP**, and **TTFB** metrics, along with the number of data points available for 
each metric. 

Additionally:

- Metrics are **grouped by URL** and by **patterns** for groups of URLs, providing flexibility in analysis for both individual pages and logical collections of pages.
- Includes a **device-level breakdown**, categorizing metrics separately for **desktop** and **mobile**.
- Provides **page view counts** (pageviews) and **organic traffic** (organic) metrics, offering insights into user activity and search-driven traffic.

An example response:

```json
[
  {
    "type": "group",
    "name": "Catalog",
    "pattern": "https://www.aem.live/docs/*",
    "pageviews": 12000,
    "organic": 4000,
    "metrics": [
      {
        "deviceType": "desktop",
        "pageviews": 8000,
        "organic": 3000,
        "lcp": 40,
        "lcpCount": 6,
        "cls": 0.3,
        "clsCount": 3,
        "inp": 30,
        "inpCount": 3,
        "ttfb": 30,
        "ttfbCount": 3
      },
      {
        "deviceType": "mobile",
        "pageviews": 1000,
        "organic": 200,
        "lcp": 40,
        "lcpCount": 6,
        "cls": 0.3,
        "clsCount": 3,
        "inp": 30,
        "inpCount": 3,
        "ttfb": 30,
        "ttfbCount": 3
      }
    ]
  },
  {
    "type": "url",
    "url": "https://www.aem.live/home",
    "pageviews": 2620,
    "organic": 1900,
    "metrics": [
      {
        "deviceType": "desktop",
        "pageviews": 2420,
        "organic": 1700,
        "lcp": 2099.699999988079,
        "lcpCount": 8,
        "cls": 0.011145537287059668,
        "clsCount": 7,
        "inp": 8,
        "inpCount": 5,
        "ttfb": 548,
        "ttfbCount": 16
      }
    ]
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
[
  {
    "type": "url",
    "url": "https://www.aem.live/home",
    "pageviews": 2620,
    "organic": 1900,
    "metrics": [
      {
        "deviceType": "desktop",
        "pageviews": 2420,
        "lcp": 2099.699999988079,
        "lcpCount": 8,
        "cls": 0.011145537287059668,
        "clsCount": 7,
        "inp": 8,
        "inpCount": 5,
        "ttfb": 548,
        "ttfbCount": 16
      },
      {
        "deviceType": "mobile",
        "pageviews": 100,
        "lcp": 2454.2,
        "lcpCount": 1,
        "cls": 0.26956930913977606,
        "clsCount": 1,
        "inp": null,
        "inpCount": 0,
        "ttfb": 807.2999999858439,
        "ttfbCount": 1
      }
    ]
  },
  {
    "type": "url",
    "url": "https://www.aem.live/docs/",
    "pageviews": 1910,
    "organic": 602,
    "metrics": [
      {
        "deviceType": "desktop",
        "pageviews": 1804,
        "lcp": 665.9000000059605,
        "lcpCount": 11,
        "cls": 0.012401669733174766,
        "clsCount": 11,
        "inp": 32,
        "inpCount": 8,
        "ttfb": 253.20000000298023,
        "ttfbCount": 12
      },
      {
        "deviceType": "mobile",
        "pageviews": 106,
        "lcp": 26276.5,
        "lcpCount": 4,
        "cls": null,
        "clsCount": 5,
        "inp": 48,
        "inpCount": 1,
        "ttfb": 86,
        "ttfbCount": 5
      }
    ]
  }
]

```

### high-inorganic-high-bounce-rate (Experimentation Opportunity)

Calculates the amount of inorganic traffic and the bounce rate for each page. Identifies pages with both high inorganic traffic and high bounce rates, which can be targeted for future experimentation opportunities. An example payload is provided below:

```json
[
  {
    "type": "high-inorganic-high-bounce-rate",
    "page": "https://www.spacecat.com/",
    "screenshot": "",
    "trackedPageKPIName": "Bounce Rate",
    "trackedPageKPIValue": 0.6507592190889371,
    "trackedKPISiteAverage": "",
    "pageViews": 46100,
    "samples": 46100,
    "metrics": [
      {
        "type": "traffic",
        "value": {
          "total": 46100,
          "paid": 40700,
          "owned": 5400,
          "earned": 0
        }
      }
    ]
  },
  {
    "type": "high-inorganic-high-bounce-rate",
    "page": "https://www.spacecat.com/pricing",
    "screenshot": "",
    "trackedPageKPIName": "Bounce Rate",
    "trackedPageKPIValue": 0.8723897911832946,
    "trackedKPISiteAverage": "",
    "pageViews": 43100,
    "samples": 43100,
    "metrics": [
      {
        "type": "traffic",
        "value": {
          "total": 43100,
          "paid": 24100,
          "owned": 19000,
          "earned": 0
        }
      }
    ]
  }
]
```

### high-organic-low-ctr (Experimentation Opportunity)

Calculates the amount of non-inorganic (earned and owned) traffic and the click-through rate for each page and vendor. Identifies pages with high non-inorganic traffic and low click-through rates, which can be targeted for future experimentation opportunities. An example payload is provided below:

```json
[
  {
    "type": "high-organic-low-ctr",
    "page": "https://www.spacecat.com/about-us",
    "screenshot": "",
    "trackedPageKPIName": "Click Through Rate",
    "trackedPageKPIValue": 0.14316702819956617,
    "trackedKPISiteAverage": 0.40828402366863903,
    "pageViews": 46100,
    "samples": 46100,
    "metrics": [
      {
        "type": "traffic",
        "vendor": "*",
        "value": {
          "total": 46100,
          "paid": 300,
          "owned": 45800,
          "earned": 0
        }
      },
      {
        "type": "ctr",
        "vendor": "*",
        "value": {
          "page": 0.14316702819956617
        }
      },
      {
        "type": "traffic",
        "vendor": "tiktok",
        "value": {
          "total": 300,
          "owned": 0,
          "earned": 0,
          "paid": 300
        }
      },
      {
        "type": "ctr",
        "vendor": "tiktok",
        "value": {
          "page": 0.3333333333333333
        }
      }
    ]
  }
]

```

### form-vitals

Collects form vitals for a specified domain within a given time interval. Identifies whether each URL has embedded forms and counts form views/submission/engagement. This data can infer opportunities, such as URLs with low CTR and limited form engagement, URLs with high page views but fewer form submissions etc.
An example response:

```json
[
  {
    "url": "https://business.adobe.com/",
    "formsubmit": {},
    "formview": {
      "desktop:mac": 800,
      "desktop:windows": 1900,
      "mobile:ios": 100,
      "mobile:android": 300
    },
    "formengagement": {
      "desktop:windows": 100
    },
    "pageview": {
      "desktop:mac": 800,
      "desktop:windows": 1900,
      "mobile:ios": 100,
      "mobile:android": 300
    }
  },
  {
    "url": "https://business.adobe.com/se/resources/main.html",
    "formsubmit": {      
      "desktop:windows": 100
    },
    "formview": {},
    "formengagement": {
      "desktop:windows": 100
    },
    "pageview": {
      "desktop:windows": 100
    }
  }
]
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
