import type { workspaceProjectConnections } from "../../../../../../types/paths/v1/workspaces/{workspace_id}/projects/{project_id}/connections.types.js";

export const GET: workspaceProjectConnections = async ($) => {
  return $.response[200].random();
};
