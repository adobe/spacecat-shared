import type { handlers_Condition } from "./handlers.Condition.js";
import type { handlers_Filter } from "./handlers.Filter.js";

export type handlers_SegmentWithProjectResponse = {
  conditions?: Array<handlers_Condition>;
  created_at?: string;
  filters?: handlers_Filter;
  id?: string;
  name?: string;
  project_id?: string;
  project_name?: string;
  updated_at?: string;
};
