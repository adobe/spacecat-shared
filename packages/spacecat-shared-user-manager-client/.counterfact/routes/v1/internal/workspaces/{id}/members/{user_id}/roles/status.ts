import type { workspacesCheckRolesInAncestry } from "../../../../../../../../types/paths/v1/internal/workspaces/{id}/members/{user_id}/roles/status.types.js";

export const GET: workspacesCheckRolesInAncestry = async ($) => {
  return $.response[200].random();
};
