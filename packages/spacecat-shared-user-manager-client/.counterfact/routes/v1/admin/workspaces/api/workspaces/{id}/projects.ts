import type { activationPanelProjectsFind } from "../../../../../../../types/paths/v1/admin/workspaces/api/workspaces/{id}/projects.types.js";

export const GET: activationPanelProjectsFind = async ($) => {
  return $.response[200].random();
};
