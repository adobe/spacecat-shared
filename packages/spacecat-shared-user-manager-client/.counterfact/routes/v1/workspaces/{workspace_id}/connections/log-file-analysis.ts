import type { logFileAnalysisConnectionCreate } from "../../../../../types/paths/v1/workspaces/{workspace_id}/connections/log-file-analysis.types.js";

export const POST: logFileAnalysisConnectionCreate = async ($) => {
  return $.response[201].empty();
};
