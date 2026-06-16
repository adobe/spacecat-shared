import type { activationPanelWorkspaceCreateMaster } from "../../../../../types/paths/v1/admin/workspaces/api/create.types.js";

export const POST: activationPanelWorkspaceCreateMaster = async ($) => {
  return $.response[201].empty();
};
