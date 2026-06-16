import type { workspacesCheckMembershipInAncestry } from "../../../../../../../types/paths/v1/internal/workspaces/{id}/members/{user_id}/status.types.js";

export const GET: workspacesCheckMembershipInAncestry = async ($) => {
  return $.response[200].random();
};
