import type { projectInternalTagsTree } from "../../../../../../../../../../types/paths/v1/internal/workspaces/{id}/projects/{project_id}/targets/{target_id}/tags/tree.types.js";

export const GET: projectInternalTagsTree = async ($) => {
  return $.response[200].random();
};
