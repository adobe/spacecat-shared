import type { adminWorkspaceProductUpdate } from "../../../../../types/paths/v1/admin/workspaces/{id}/products.types.js";
import type { adminWorkspaceProductCreate } from "../../../../../types/paths/v1/admin/workspaces/{id}/products.types.js";

export const PATCH: adminWorkspaceProductUpdate = async ($) => {
  return $.response[204].empty();
};

export const POST: adminWorkspaceProductCreate = async ($) => {
  return $.response[204].empty();
};
