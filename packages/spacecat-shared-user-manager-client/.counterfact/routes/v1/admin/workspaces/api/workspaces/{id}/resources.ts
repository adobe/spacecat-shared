import type { activationPanelWorkspaceResources } from "../../../../../../../types/paths/v1/admin/workspaces/api/workspaces/{id}/resources.types.js";

export const GET: activationPanelWorkspaceResources = async ($) => {
  return $.response[200].random();
};
