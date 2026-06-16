import type { handlers_LogFileAnalysisPreProcessing } from "./handlers.LogFileAnalysisPreProcessing.js";

export type handlers_LogFileAnalysisIngestParser = {
  delimiter?: "space" | "pipe" | "tab" | "semicolum" | "comma";
  preProcessing?: handlers_LogFileAnalysisPreProcessing;
  type: "json" | "jsonp" | "text";
};
