import type { adminWorkspaceProductDelete } from "../../../../../../types/paths/v1/admin/workspaces/{id}/products/{product_id}.types.js";

export const DELETE: adminWorkspaceProductDelete = async ($) => {
  return $.response[204].empty();
};
