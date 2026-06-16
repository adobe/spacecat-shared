import type { workspaceOwnerApiKeyGet } from "../../../types/paths/workspaces/{id}/api-key.types.js";

export const GET: workspaceOwnerApiKeyGet = async ($) => {
  return $.response[200].random();
};
