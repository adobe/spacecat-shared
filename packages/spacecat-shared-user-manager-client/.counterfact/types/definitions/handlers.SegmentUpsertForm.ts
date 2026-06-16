import type { handlers_Condition } from "./handlers.Condition.js";
import type { handlers_Filter } from "./handlers.Filter.js";

export type handlers_SegmentUpsertForm = {
  conditions?: Array<handlers_Condition>;
  /**
   * todo: after conditions removed this field should be required.
   */
  filters?: handlers_Filter;
  name: string;
};
