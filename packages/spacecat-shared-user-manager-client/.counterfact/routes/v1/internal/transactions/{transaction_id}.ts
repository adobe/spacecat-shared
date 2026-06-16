import type { serviceCreditsInternalTransactionGet } from "../../../../types/paths/v1/internal/transactions/{transaction_id}.types.js";

export const GET: serviceCreditsInternalTransactionGet = async ($) => {
  return $.response[200].random();
};
