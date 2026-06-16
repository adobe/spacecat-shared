import type { handlers_LogFileAnalysisFallbackValues } from "./handlers.LogFileAnalysisFallbackValues.js";
import type { handlers_LogFileAnalysisIngestSchema } from "./handlers.LogFileAnalysisIngestSchema.js";

/**
 * Log file analysis connection settings
 */
export type handlers_LogFileAnalysisConnectionSettings = {
  connectionName: string;
  deliveryType?: string;
  fallbackValues?: handlers_LogFileAnalysisFallbackValues;
  ingestSchema?: handlers_LogFileAnalysisIngestSchema;
};
