import type { internalWorkspaceProjectConnections } from "../../../../../../../types/paths/v1/internal/workspaces/{workspace_id}/projects/{project_id}/connections.types.js";

export const GET: internalWorkspaceProjectConnections = async ($) => {
  return $.response[200].random();
};
