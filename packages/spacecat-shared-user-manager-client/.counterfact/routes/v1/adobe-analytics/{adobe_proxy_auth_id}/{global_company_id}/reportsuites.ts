import type { adobeAnalyticsGetReportSuites } from "../../../../../types/paths/v1/adobe-analytics/{adobe_proxy_auth_id}/{global_company_id}/reportsuites.types.js";

export const GET: adobeAnalyticsGetReportSuites = async ($) => {
  return $.response[200].random();
};
