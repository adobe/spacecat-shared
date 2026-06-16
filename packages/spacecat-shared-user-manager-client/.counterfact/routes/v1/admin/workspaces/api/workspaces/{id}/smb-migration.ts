import type { activationPanelProjectsMigration } from "../../../../../../../types/paths/v1/admin/workspaces/api/workspaces/{id}/smb-migration.types.js";

export const POST: activationPanelProjectsMigration = async ($) => {
  return $.response[204].empty();
};
