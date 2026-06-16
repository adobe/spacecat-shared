import type { workspaceConnectionsMerge } from "../../../../../types/paths/v1/workspaces/{workspace_id}/connections/attach-projects.types.js";

export const POST: workspaceConnectionsMerge = async ($) => {
  return $.response[200].empty();
};
