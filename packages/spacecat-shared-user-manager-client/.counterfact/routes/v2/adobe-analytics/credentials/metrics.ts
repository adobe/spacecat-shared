import type { adobeAnalyticsGetMetricsV2 } from "../../../../types/paths/v2/adobe-analytics/credentials/metrics.types.js";

export const GET: adobeAnalyticsGetMetricsV2 = async ($) => {
  return $.response[200].random();
};
