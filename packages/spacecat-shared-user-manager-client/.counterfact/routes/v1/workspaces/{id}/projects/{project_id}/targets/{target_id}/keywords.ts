import type { projectDeleteKeywords } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords.types.js";
import type { projectGetKeywords } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords.types.js";
import type { projectAddKeywords } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords.types.js";

export const DELETE: projectDeleteKeywords = async ($) => {
  return $.response[200].random();
};

export const GET: projectGetKeywords = async ($) => {
  return $.response[200].random();
};

export const POST: projectAddKeywords = async ($) => {
  return $.response[200].random();
};
