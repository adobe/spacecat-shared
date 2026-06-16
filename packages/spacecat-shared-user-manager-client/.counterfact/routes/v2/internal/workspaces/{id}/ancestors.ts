import type { internalWorkspacesAncestorV2 } from "../../../../../types/paths/v2/internal/workspaces/{id}/ancestors.types.js";

export const GET: internalWorkspacesAncestorV2 = async ($) => {
  return $.response[200].random();
};
