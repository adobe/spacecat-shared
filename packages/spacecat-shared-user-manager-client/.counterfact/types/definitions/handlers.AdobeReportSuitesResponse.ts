import type { handlers_ReportSuite } from "./handlers.ReportSuite.js";

export type handlers_AdobeReportSuitesResponse = {
  content?: Array<handlers_ReportSuite>;
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
};
