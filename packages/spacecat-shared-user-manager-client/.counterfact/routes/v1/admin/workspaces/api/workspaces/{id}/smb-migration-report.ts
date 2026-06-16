import type { activationPanelProjectsMigrationReport } from "../../../../../../../types/paths/v1/admin/workspaces/api/workspaces/{id}/smb-migration-report.types.js";

export const GET: activationPanelProjectsMigrationReport = async ($) => {
  return $.response[200].empty();
};
