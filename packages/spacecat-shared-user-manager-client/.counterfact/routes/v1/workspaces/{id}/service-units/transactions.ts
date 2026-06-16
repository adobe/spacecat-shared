import type { serviceCreditsTransactionsList } from "../../../../../types/paths/v1/workspaces/{id}/service-units/transactions.types.js";

export const POST: serviceCreditsTransactionsList = async ($) => {
  return $.response[200].random();
};
