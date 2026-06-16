import type { projectDelete } from "../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}.types.js";
import type { projectGet } from "../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}.types.js";
import type { projectUpdate } from "../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}.types.js";

export const DELETE: projectDelete = async ($) => {
  return $.response[200].random();
};

export const GET: projectGet = async ($) => {
  return $.response[200].random();
};

export const PUT: projectUpdate = async ($) => {
  return $.response[200].random();
};
