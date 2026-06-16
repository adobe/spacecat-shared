import type { adobeAnalyticsGetReportSuitesPaginated } from "../../../../../../types/paths/v1/adobe-analytics/{adobe_proxy_auth_id}/{global_company_id}/reportsuites/paginated.types.js";

export const GET: adobeAnalyticsGetReportSuitesPaginated = async ($) => {
  return $.response[200].random();
};
