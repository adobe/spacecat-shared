import type { projectDeleteTagsBatchV2 } from "../../../../../../../../types/paths/v2/workspaces/{id}/projects/{project_id}/targets/{target_id}/tags.types.js";
import type { projectGetTagsWithSearch } from "../../../../../../../../types/paths/v2/workspaces/{id}/projects/{project_id}/targets/{target_id}/tags.types.js";

export const DELETE: projectDeleteTagsBatchV2 = async ($) => {
  return $.response[204].empty();
};

export const GET: projectGetTagsWithSearch = async ($) => {
  return $.response[200].random();
};
