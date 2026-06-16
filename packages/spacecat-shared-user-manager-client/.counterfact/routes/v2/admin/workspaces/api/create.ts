import type { activationPanelWorkspaceCreateMasterV2 } from "../../../../../types/paths/v2/admin/workspaces/api/create.types.js";

export const POST: activationPanelWorkspaceCreateMasterV2 = async ($) => {
  return $.response[201].empty();
};
