import type { internalWorkspaceProductLimitsByProject } from "../../../../../../../../../types/paths/v2/internal/workspaces/{id}/products/{product_id}/projects/{project_id}/limits.types.js";

export const GET: internalWorkspaceProductLimitsByProject = async ($) => {
  return $.response[200].random();
};
