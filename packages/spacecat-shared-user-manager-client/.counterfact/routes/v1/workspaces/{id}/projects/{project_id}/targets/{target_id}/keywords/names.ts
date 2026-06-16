import type { targetsKeywordsByNames } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords/names.types.js";

export const POST: targetsKeywordsByNames = async ($) => {
  return $.response[200].random();
};
