import type { adobeAnalyticsConnectionCreate } from "../../../../../types/paths/v1/workspaces/{workspace_id}/connections/adobe-analytics.types.js";

export const POST: adobeAnalyticsConnectionCreate = async ($) => {
  return $.response[201].empty();
};
