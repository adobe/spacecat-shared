import type { adobeAnalyticsGetDimensionsV2 } from "../../../../types/paths/v2/adobe-analytics/credentials/dimensions.types.js";

export const GET: adobeAnalyticsGetDimensionsV2 = async ($) => {
  return $.response[200].random();
};
