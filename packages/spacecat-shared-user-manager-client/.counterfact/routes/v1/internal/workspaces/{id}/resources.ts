import type { internalWorkspaceResources } from "../../../../../types/paths/v1/internal/workspaces/{id}/resources.types.js";

export const GET: internalWorkspaceResources = async ($) => {
  return $.response[200].random();
};
