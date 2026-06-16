import type { internalWorkspaceConnectionByid } from "../../../../../../types/paths/v1/internal/workspaces/{workspace_id}/connections/{connection_id}.types.js";

export const GET: internalWorkspaceConnectionByid = async ($) => {
  return $.response[200].random();
};
