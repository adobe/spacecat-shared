import type { projectSearchTreeTags } from "../../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/tags/tree/search.types.js";

export const GET: projectSearchTreeTags = async ($) => {
  return $.response[200].random();
};
