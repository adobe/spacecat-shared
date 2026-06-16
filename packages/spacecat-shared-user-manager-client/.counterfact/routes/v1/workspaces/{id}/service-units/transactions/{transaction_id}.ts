import type { serviceCreditsTransactionGet } from "../../../../../../types/paths/v1/workspaces/{id}/service-units/transactions/{transaction_id}.types.js";

export const GET: serviceCreditsTransactionGet = async ($) => {
  return $.response[200].random();
};
