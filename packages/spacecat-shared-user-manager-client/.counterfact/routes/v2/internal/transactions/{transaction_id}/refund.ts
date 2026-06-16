import type { transactionRefundV2 } from "../../../../../types/paths/v2/internal/transactions/{transaction_id}/refund.types.js";

export const POST: transactionRefundV2 = async ($) => {
  return $.response[200].random();
};
