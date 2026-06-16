import type { projectTagsTree } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/tags/tree.types.js";

export const GET: projectTagsTree = async ($) => {
  return $.response[200].random();
};
