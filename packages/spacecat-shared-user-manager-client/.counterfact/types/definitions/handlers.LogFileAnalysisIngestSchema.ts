import type { handlers_LogFileAnalysisIngestField } from "./handlers.LogFileAnalysisIngestField.js";
import type { handlers_LogFileAnalysisIngestParser } from "./handlers.LogFileAnalysisIngestParser.js";

export type handlers_LogFileAnalysisIngestSchema = {
  example?: string;
  fields: Array<handlers_LogFileAnalysisIngestField>;
  parser: handlers_LogFileAnalysisIngestParser;
};
