import type { keywordsRelatedTagIdsGet } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords/related-tags-ids.types.js";

export const POST: keywordsRelatedTagIdsGet = async ($) => {
  return $.response[200].random();
};
