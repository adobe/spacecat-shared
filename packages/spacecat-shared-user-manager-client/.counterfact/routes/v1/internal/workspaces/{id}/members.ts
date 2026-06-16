import type { internalWorkspacesMembers } from "../../../../../types/paths/v1/internal/workspaces/{id}/members.types.js";
import type { internalWorkspaceAddMembers } from "../../../../../types/paths/v1/internal/workspaces/{id}/members.types.js";

export const GET: internalWorkspacesMembers = async ($) => {
  return $.response[200].random();
};

export const POST: internalWorkspaceAddMembers = async ($) => {
  return $.response[200].random();
};
