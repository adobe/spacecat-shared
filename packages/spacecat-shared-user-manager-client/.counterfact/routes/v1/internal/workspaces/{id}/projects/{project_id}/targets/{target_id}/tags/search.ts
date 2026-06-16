import type { projectInternalSearchListTags } from "../../../../../../../../../../types/paths/v1/internal/workspaces/{id}/projects/{project_id}/targets/{target_id}/tags/search.types.js";

export const GET: projectInternalSearchListTags = async ($) => {
  return $.response[200].random();
};
