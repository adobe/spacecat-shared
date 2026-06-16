import type { projectGetKeywordsV3 } from "../../../../../../../../types/paths/v3/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords.types.js";

export const POST: projectGetKeywordsV3 = async ($) => {
  return $.response[200].random();
};
