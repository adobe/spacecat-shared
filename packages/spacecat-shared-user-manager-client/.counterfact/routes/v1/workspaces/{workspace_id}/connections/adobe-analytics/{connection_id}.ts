import type { adobeAnalyticsConnectionUpdate } from "../../../../../../types/paths/v1/workspaces/{workspace_id}/connections/adobe-analytics/{connection_id}.types.js";

export const PUT: adobeAnalyticsConnectionUpdate = async ($) => {
  return $.response[200].empty();
};
