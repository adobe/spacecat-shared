import type { transactionCancel } from "../../../../../types/paths/v1/internal/transactions/{transaction_id}/cancel.types.js";

export const POST: transactionCancel = async ($) => {
  return $.response[200].random();
};
