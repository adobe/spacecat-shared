import type { workspaceDetailsParent } from "../../../../types/paths/v1/workspaces/{id}/parent.types.js";

export const GET: workspaceDetailsParent = async ($) => {
  return $.response[200].random();
};
