import type { projectDeleteMembers } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/members.types.js";
import type { projectMembers } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/members.types.js";
import type { projectUpdateMembersRole } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/members.types.js";
import type { projectAddMembers } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/members.types.js";

export const DELETE: projectDeleteMembers = async ($) => {
  return $.response[204].empty();
};

export const GET: projectMembers = async ($) => {
  return $.response[200].random();
};

export const PATCH: projectUpdateMembersRole = async ($) => {
  return $.response[204].empty();
};

export const POST: projectAddMembers = async ($) => {
  return $.response[201].empty();
};
