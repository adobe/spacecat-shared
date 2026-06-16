import type { activationPanelGetAllOrganizations } from "../../../../../types/paths/v1/admin/workspaces/api/organizations.types.js";

export const GET: activationPanelGetAllOrganizations = async ($) => {
  return $.response[200].random();
};
