import type { transactionCreateV2 } from "../../../types/paths/v2/internal/transactions.types.js";

export const POST: transactionCreateV2 = async ($) => {
  return $.response[200].random();
};
