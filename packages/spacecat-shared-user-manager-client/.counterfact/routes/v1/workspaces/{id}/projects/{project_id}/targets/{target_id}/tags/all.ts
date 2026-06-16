import type { projectTagsAll } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/tags/all.types.js";

export const GET: projectTagsAll = async ($) => {
  return $.response[200].random();
};
