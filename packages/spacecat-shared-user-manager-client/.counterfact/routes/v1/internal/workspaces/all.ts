import type { internalWorkspacesAllList } from "../../../../types/paths/v1/internal/workspaces/all.types.js";

export const GET: internalWorkspacesAllList = async ($) => {
  return $.response[200].random();
};
