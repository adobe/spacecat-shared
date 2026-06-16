import type { internalWorkspaceConnectionsList } from "../../../../../types/paths/v1/internal/workspaces/{workspace_id}/connections.types.js";

export const GET: internalWorkspaceConnectionsList = async ($) => {
  return $.response[200].random();
};
