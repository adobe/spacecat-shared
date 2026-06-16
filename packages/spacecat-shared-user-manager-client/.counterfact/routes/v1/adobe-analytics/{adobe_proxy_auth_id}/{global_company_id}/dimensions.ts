import type { adobeAnalyticsGetDimensions } from "../../../../../types/paths/v1/adobe-analytics/{adobe_proxy_auth_id}/{global_company_id}/dimensions.types.js";

export const GET: adobeAnalyticsGetDimensions = async ($) => {
  return $.response[200].random();
};
