import type { adobeAnalyticsConnectionCreateV2 } from "../../../../../types/paths/v2/workspaces/{workspace_id}/connections/adobe-analytics.types.js";

export const POST: adobeAnalyticsConnectionCreateV2 = async ($) => {
  return $.response[201].empty();
};
