import type { adminWorkspaceUpdatePartnership } from "../../../../../types/paths/v1/admin/workspaces/{id}/partnership.types.js";

export const PATCH: adminWorkspaceUpdatePartnership = async ($) => {
  return $.response[204].empty();
};
