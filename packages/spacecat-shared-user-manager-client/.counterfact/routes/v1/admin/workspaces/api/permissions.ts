import type { activationPanelWorkspacePermissions } from "../../../../../types/paths/v1/admin/workspaces/api/permissions.types.js";

export const GET: activationPanelWorkspacePermissions = async ($) => {
  return $.response[200].random();
};
