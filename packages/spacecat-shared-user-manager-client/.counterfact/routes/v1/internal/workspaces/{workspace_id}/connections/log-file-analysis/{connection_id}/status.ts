import type { internalLogFileAnalysisConnectionStatusPatch } from "../../../../../../../../types/paths/v1/internal/workspaces/{workspace_id}/connections/log-file-analysis/{connection_id}/status.types.js";

export const PATCH: internalLogFileAnalysisConnectionStatusPatch = async (
  $,
) => {
  return $.response[204].empty();
};
