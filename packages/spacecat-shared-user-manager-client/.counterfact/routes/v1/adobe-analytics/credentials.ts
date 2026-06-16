import type { adobeAnalyticsCreateCredentials } from "../../../types/paths/v1/adobe-analytics/credentials.types.js";

export const POST: adobeAnalyticsCreateCredentials = async ($) => {
  return $.response[201].random();
};
