import type { handlers_LogFileAnalysisConnectionSettings } from "./handlers.LogFileAnalysisConnectionSettings.js";

export type handlers_LogFileAnalysisWorkspaceConnectionPayload = {
  project_ids: Array<string>;
  settings: handlers_LogFileAnalysisConnectionSettings;
};
