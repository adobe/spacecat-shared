import type { handlers_Transaction } from "./handlers.Transaction.js";

export type handlers_transactionsListResponse = {
  items?: Array<handlers_Transaction>;
  page?: number;
  total?: number;
};
