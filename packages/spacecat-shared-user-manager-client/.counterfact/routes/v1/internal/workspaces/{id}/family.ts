import type { internalWorkspacesFamily } from "../../../../../types/paths/v1/internal/workspaces/{id}/family.types.js";

export const GET: internalWorkspacesFamily = async ($) => {
  return $.response[200].random();
};
