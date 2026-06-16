import type { projectDeleteTags } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/tags.types.js";
import type { projectGetTags } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/tags.types.js";
import type { projectAddTags } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/tags.types.js";

export const DELETE: projectDeleteTags = async ($) => {
  return $.response[200].random();
};

export const GET: projectGetTags = async ($) => {
  return $.response[200].random();
};

export const POST: projectAddTags = async ($) => {
  return $.response[200].random();
};
