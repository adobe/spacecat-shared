import type { internalBatchWorkspacesMembers } from "../../../../../types/paths/v1/internal/workspaces/members/batch.types.js";

export const POST: internalBatchWorkspacesMembers = async ($) => {
  return $.response[200].random();
};
