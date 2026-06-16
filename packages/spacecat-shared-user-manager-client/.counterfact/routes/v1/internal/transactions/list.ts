import type { serviceCreditsInternalTransactionsList } from "../../../../types/paths/v1/internal/transactions/list.types.js";

export const POST: serviceCreditsInternalTransactionsList = async ($) => {
  return $.response[200].random();
};
