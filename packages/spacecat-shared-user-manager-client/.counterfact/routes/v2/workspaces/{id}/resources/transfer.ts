import type { workspaceTransferResourcesV2 } from "../../../../../types/paths/v2/workspaces/{id}/resources/transfer.types.js";

export const POST: workspaceTransferResourcesV2 = async ($) => {
  return $.response[200].random();
};
