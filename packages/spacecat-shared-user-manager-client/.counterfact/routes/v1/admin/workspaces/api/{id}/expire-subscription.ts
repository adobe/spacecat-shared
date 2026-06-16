import type { adminWorkspaceUpdateExpiration } from "../../../../../../types/paths/v1/admin/workspaces/api/{id}/expire-subscription.types.js";

export const PATCH: adminWorkspaceUpdateExpiration = async ($) => {
  return $.response[204].empty();
};
