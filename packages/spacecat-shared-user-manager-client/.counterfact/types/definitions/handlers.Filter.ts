import type { handlers_Filter } from "./handlers.Filter.js";

export type handlers_Filter = {
  column_name?: string;
  filters?: Array<handlers_Filter>;
  operator: string;
  value: unknown;
};
