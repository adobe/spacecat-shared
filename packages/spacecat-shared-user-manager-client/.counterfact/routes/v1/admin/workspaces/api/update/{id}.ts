import type { activationPanelWorkspaceUpdate } from "../../../../../../types/paths/v1/admin/workspaces/api/update/{id}.types.js";

export const PUT: activationPanelWorkspaceUpdate = async ($) => {
  return $.response[204].empty();
};
