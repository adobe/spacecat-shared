import type { internalWorkspacesAncestor } from "../../../../../types/paths/v1/internal/workspaces/{id}/ancestors.types.js";

export const GET: internalWorkspacesAncestor = async ($) => {
  return $.response[200].random();
};
