import type { internalWorkspacesFamilyV2 } from "../../../../../types/paths/v2/internal/workspaces/{id}/family.types.js";

export const GET: internalWorkspacesFamilyV2 = async ($) => {
  return $.response[200].random();
};
