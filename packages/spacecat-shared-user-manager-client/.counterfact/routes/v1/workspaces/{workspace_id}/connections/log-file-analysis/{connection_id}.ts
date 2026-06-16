import type { logFileAnalysisConnectionUpdate } from "../../../../../../types/paths/v1/workspaces/{workspace_id}/connections/log-file-analysis/{connection_id}.types.js";

export const PUT: logFileAnalysisConnectionUpdate = async ($) => {
  return $.response[200].empty();
};
