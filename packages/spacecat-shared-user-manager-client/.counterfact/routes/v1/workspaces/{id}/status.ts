import type { workspacesStatusGet } from "../../../../types/paths/v1/workspaces/{id}/status.types.js";

export const GET: workspacesStatusGet = async ($) => {
  return $.response[200].random();
};
