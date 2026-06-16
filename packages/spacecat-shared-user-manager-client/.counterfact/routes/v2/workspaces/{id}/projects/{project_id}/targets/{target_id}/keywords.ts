import type { projectGetKeywordsV2 } from "../../../../../../../../types/paths/v2/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords.types.js";

export const POST: projectGetKeywordsV2 = async ($) => {
  return $.response[200].random();
};
