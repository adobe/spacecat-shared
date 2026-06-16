import type { transactionCreate } from "../../../types/paths/v1/internal/transactions.types.js";

export const POST: transactionCreate = async ($) => {
  return $.response[200].random();
};
