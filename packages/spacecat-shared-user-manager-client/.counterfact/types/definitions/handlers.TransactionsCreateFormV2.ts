import type { handlers_TxProductLimit } from "./handlers.TxProductLimit.js";

export type handlers_TransactionsCreateFormV2 = {
  amount: number;
  global_limit_key?: string;
  owner_id?: number;
  product_limit?: handlers_TxProductLimit;
  receipt_id?: number;
  service_id: string;
  service_type: string;
  title?: string;
  workspace_id: string;
};
