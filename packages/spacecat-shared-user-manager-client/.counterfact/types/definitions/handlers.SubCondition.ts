import type { handlers_Condition } from "./handlers.Condition.js";

export type handlers_SubCondition = {
  condition: handlers_Condition;
  logic_operator: "and" | "or";
};
