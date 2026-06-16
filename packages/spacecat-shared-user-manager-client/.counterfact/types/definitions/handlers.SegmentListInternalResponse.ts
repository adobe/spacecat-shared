import type { handlers_SegmentInternalResponse } from "./handlers.SegmentInternalResponse.js";

export type handlers_SegmentListInternalResponse = {
  items?: Array<handlers_SegmentInternalResponse>;
  page?: number;
  total?: number;
};
