import type { projectDeleteKeywordTagsBatchV2 } from "../../../../../../../../../types/paths/v2/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords/tags.types.js";
import type { projectUpdateKeywordTagsBatchV2 } from "../../../../../../../../../types/paths/v2/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords/tags.types.js";

export const DELETE: projectDeleteKeywordTagsBatchV2 = async ($) => {
  return $.response[204].empty();
};

export const PUT: projectUpdateKeywordTagsBatchV2 = async ($) => {
  return $.response[204].empty();
};
