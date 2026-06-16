import type { handlers_internalGoal } from "./handlers.internalGoal.js";

export type handlers_internalGoalsListResponse = {
  items?: Array<handlers_internalGoal>;
  page?: number;
  total?: number;
};
