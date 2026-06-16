import type { handlers_SubCondition } from "./handlers.SubCondition.js";

export type handlers_Condition = {
  column_name: string;
  operator: string;
  sub_conditions?: Array<handlers_SubCondition>;
  value: string;
  values: Array<string>;
};
