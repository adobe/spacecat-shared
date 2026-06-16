import type { workspaceConnectionsDelete } from "../../../../types/paths/v1/workspaces/{workspace_id}/connections.types.js";
import type { workspaceConnections } from "../../../../types/paths/v1/workspaces/{workspace_id}/connections.types.js";

export const DELETE: workspaceConnectionsDelete = async ($) => {
  return $.response[200].empty();
};

export const GET: workspaceConnections = async ($) => {
  return $.response[200].random();
};
