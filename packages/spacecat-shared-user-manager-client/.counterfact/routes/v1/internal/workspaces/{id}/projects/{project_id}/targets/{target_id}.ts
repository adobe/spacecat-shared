import type { internalProjectTargetDetails } from "../../../../../../../../types/paths/v1/internal/workspaces/{id}/projects/{project_id}/targets/{target_id}.types.js";

export const GET: internalProjectTargetDetails = async ($) => {
  return $.response[200].random();
};
