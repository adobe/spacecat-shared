import type { activationPanelGetAllWorkspaces } from "../../../../../types/paths/v1/admin/workspaces/api/list.types.js";

export const GET: activationPanelGetAllWorkspaces = async ($) => {
  return $.response[200].random();
};
