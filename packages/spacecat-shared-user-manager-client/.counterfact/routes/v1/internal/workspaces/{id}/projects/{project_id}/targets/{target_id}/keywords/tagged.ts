import type { projectGetTaggedKeywords } from "../../../../../../../../../../types/paths/v1/internal/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords/tagged.types.js";

export const GET: projectGetTaggedKeywords = async ($) => {
  return $.response[201].empty();
};
