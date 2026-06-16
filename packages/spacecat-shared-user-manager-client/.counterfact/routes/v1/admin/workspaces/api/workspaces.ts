import type { activationPanelAllWorkspacesFind } from "../../../../../types/paths/v1/admin/workspaces/api/workspaces.types.js";

export const GET: activationPanelAllWorkspacesFind = async ($) => {
  return $.response[200].random();
};
