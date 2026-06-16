import type { adobeAnalyticsGetReportSuitesPaginatedV2 } from "../../../../../types/paths/v2/adobe-analytics/credentials/reportsuites/paginated.types.js";

export const GET: adobeAnalyticsGetReportSuitesPaginatedV2 = async ($) => {
  return $.response[200].random();
};
