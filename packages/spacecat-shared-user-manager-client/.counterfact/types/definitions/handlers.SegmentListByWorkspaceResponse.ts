import type { handlers_SegmentWithProjectResponse } from "./handlers.SegmentWithProjectResponse.js";

export type handlers_SegmentListByWorkspaceResponse = {
  items?: Array<handlers_SegmentWithProjectResponse>;
  page?: number;
  total?: number;
};
