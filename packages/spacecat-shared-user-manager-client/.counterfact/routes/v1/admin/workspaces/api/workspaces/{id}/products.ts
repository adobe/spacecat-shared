import type { activationPanelWorkspaceProductsGet } from "../../../../../../../types/paths/v1/admin/workspaces/api/workspaces/{id}/products.types.js";

export const GET: activationPanelWorkspaceProductsGet = async ($) => {
  return $.response[200].random();
};
