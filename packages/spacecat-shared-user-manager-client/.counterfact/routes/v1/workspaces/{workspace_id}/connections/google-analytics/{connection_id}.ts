import type { analyticsConnectionUpdate } from "../../../../../../types/paths/v1/workspaces/{workspace_id}/connections/google-analytics/{connection_id}.types.js";

export const PUT: analyticsConnectionUpdate = async ($) => {
  return $.response[200].empty();
};
