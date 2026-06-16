import type { activationPanelGetAllAdminActivities } from "../../../../../types/paths/v1/admin/workspaces/api/logs.types.js";

export const GET: activationPanelGetAllAdminActivities = async ($) => {
  return $.response[200].random();
};
