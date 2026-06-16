import type { projectAddTaggedKeywords } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords/tagged.types.js";

export const POST: projectAddTaggedKeywords = async ($) => {
  return $.response[201].empty();
};
