import type { workspaceConnectionOwners } from "../../../../../types/paths/v1/workspaces/{workspace_id}/connections/owners.types.js";

export const GET: workspaceConnectionOwners = async ($) => {
  return $.response[200].random();
};
