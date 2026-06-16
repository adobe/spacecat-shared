import type { workspacesFamily } from "../../../../types/paths/v1/workspaces/{id}/family.types.js";

export const GET: workspacesFamily = async ($) => {
  return $.response[200].random();
};
