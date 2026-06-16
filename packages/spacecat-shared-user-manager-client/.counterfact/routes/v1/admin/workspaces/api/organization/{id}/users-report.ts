import type { activationPanelUsersReport } from "../../../../../../../types/paths/v1/admin/workspaces/api/organization/{id}/users-report.types.js";

export const GET: activationPanelUsersReport = async ($) => {
  return $.response[200].random();
};
