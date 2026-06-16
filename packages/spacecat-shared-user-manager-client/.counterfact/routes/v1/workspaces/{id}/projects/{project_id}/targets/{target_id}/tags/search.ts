import type { projectSearchListTags } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/tags/search.types.js";

export const GET: projectSearchListTags = async ($) => {
  return $.response[200].random();
};
