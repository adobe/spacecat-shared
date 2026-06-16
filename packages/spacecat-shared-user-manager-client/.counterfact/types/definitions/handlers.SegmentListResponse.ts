import type { handlers_SegmentResponse } from "./handlers.SegmentResponse.js";

export type handlers_SegmentListResponse = {
  items?: Array<handlers_SegmentResponse>;
  page?: number;
  total?: number;
};
