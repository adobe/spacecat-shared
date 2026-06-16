/**
 * Connector-reported status for a log file analysis connection (internal)
 */
export type handlers_LogFileAnalysisConnectorStatusPayload = {
  message?: string;
  type: "success" | "error";
};
