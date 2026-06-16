import type { internalWorkspaceOwnerApiKeyGet } from "../../../../../types/paths/v1/internal/workspaces/{id}/api-key.types.js";

export const GET: internalWorkspaceOwnerApiKeyGet = async ($) => {
  return $.response[200].random();
};
