import type { workspaceResourcesMaster } from "../../../../../types/paths/v1/workspaces/{id}/parent/resources.types.js";

export const GET: workspaceResourcesMaster = async ($) => {
  return $.response[200].random();
};
