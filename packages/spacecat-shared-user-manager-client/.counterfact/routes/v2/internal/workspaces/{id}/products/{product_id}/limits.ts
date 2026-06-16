import type { internalWorkspaceProductLimits } from "../../../../../../../types/paths/v2/internal/workspaces/{id}/products/{product_id}/limits.types.js";

export const GET: internalWorkspaceProductLimits = async ($) => {
  return $.response[200].random();
};
