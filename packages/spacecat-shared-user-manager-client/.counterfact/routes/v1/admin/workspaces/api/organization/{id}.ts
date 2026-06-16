import type { activationPanelGetWorkspace } from "../../../../../../types/paths/v1/admin/workspaces/api/organization/{id}.types.js";

export const GET: activationPanelGetWorkspace = async ($) => {
  return $.response[200].random();
};
