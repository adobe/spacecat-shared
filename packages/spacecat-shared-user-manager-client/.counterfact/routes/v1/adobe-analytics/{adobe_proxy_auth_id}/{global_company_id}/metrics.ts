import type { adobeAnalyticsGetMetrics } from "../../../../../types/paths/v1/adobe-analytics/{adobe_proxy_auth_id}/{global_company_id}/metrics.types.js";

export const GET: adobeAnalyticsGetMetrics = async ($) => {
  return $.response[200].random();
};
