import type { internalWorkspacesLimits } from "../../../../types/paths/v1/internal/workspaces/limits.types.js";

export const GET: internalWorkspacesLimits = async ($) => {
  return $.response[200].random();
};
