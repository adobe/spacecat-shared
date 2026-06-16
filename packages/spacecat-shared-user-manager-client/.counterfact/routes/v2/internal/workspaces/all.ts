import type { internalWorkspacesAllListV2 } from "../../../../types/paths/v2/internal/workspaces/all.types.js";

export const GET: internalWorkspacesAllListV2 = async ($) => {
  return $.response[200].random();
};
