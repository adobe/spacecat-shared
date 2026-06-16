import type { internalWorkspaceGetRoot } from "../../../../types/paths/v1/internal/workspaces/root.types.js";

export const GET: internalWorkspaceGetRoot = async ($) => {
  return $.response[200].random();
};
