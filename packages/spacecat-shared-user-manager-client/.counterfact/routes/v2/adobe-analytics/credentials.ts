import type { adobeAnalyticsCreateCredentialsV2 } from "../../../types/paths/v2/adobe-analytics/credentials.types.js";

export const POST: adobeAnalyticsCreateCredentialsV2 = async ($) => {
  return $.response[201].random();
};
