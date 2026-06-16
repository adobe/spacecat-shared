import type { internalWorkspaceGet } from "../../../../types/paths/v1/internal/workspaces/{id}.types.js";

export const GET: internalWorkspaceGet = async ($) => {
  return $.response[200].random();
};
