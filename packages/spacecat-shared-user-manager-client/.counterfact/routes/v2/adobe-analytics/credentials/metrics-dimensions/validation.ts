import type { adobeAnalyticsValidateV2 } from "../../../../../types/paths/v2/adobe-analytics/credentials/metrics-dimensions/validation.types.js";

export const POST: adobeAnalyticsValidateV2 = async ($) => {
  return $.response[200].random();
};
