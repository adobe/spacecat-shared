import type { keywordsMetrics } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords/stats.types.js";

export const GET: keywordsMetrics = async ($) => {
  return $.response[200].random();
};
