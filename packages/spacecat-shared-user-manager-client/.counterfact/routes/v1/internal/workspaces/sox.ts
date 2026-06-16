import type { internalWorkspacesSoxList } from "../../../../types/paths/v1/internal/workspaces/sox.types.js";

export const GET: internalWorkspacesSoxList = async ($) => {
  return $.response[200].random();
};
