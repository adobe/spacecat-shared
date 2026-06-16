import type { adobeAnalyticsGetReportSuitesV2 } from "../../../../types/paths/v2/adobe-analytics/credentials/reportsuites.types.js";

export const GET: adobeAnalyticsGetReportSuitesV2 = async ($) => {
  return $.response[200].random();
};
