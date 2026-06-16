import type { workspaceConnectionsByid } from "../../../../../types/paths/v1/workspaces/{workspace_id}/connections/{connection_id}.types.js";

export const GET: workspaceConnectionsByid = async ($) => {
  return $.response[200].random();
};
