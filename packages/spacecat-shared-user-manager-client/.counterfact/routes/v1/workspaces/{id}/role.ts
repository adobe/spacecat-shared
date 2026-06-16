import type { userWorkspaceRole } from "../../../../types/paths/v1/workspaces/{id}/role.types.js";

export const GET: userWorkspaceRole = async ($) => {
  return $.response[200].random();
};
