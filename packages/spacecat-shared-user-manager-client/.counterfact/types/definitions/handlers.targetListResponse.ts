import type { handlers_Target } from "./handlers.Target.js";

export type handlers_targetListResponse = {
  items?: Array<handlers_Target>;
  page?: number;
  total?: number;
};
