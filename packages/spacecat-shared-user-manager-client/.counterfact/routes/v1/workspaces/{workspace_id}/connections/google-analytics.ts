import type { analyticsConnectionCreate } from "../../../../../types/paths/v1/workspaces/{workspace_id}/connections/google-analytics.types.js";

export const POST: analyticsConnectionCreate = async ($) => {
  return $.response[201].empty();
};
