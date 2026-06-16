import type { workspaceTransferResources } from "../../../../../types/paths/v1/workspaces/{id}/resources/transfer.types.js";

export const POST: workspaceTransferResources = async ($) => {
  return $.response[200].random();
};
