import type { adobeAnalyticsGetStatusV2 } from "../../../../types/paths/v2/adobe-analytics/credentials/status.types.js";

export const GET: adobeAnalyticsGetStatusV2 = async ($) => {
  return $.response[200].random();
};
