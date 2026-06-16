import type { workspaceManagersGet } from "../../../../../types/paths/v1/internal/workspaces/{id}/managers.types.js";

export const GET: workspaceManagersGet = async ($) => {
  return $.response[200].random();
};
