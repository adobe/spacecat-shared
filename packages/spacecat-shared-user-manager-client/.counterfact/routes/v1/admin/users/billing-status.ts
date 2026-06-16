import type { adminGetUserBillingStatuses } from "../../../../types/paths/v1/admin/users/billing-status.types.js";

export const POST: adminGetUserBillingStatuses = async ($) => {
  return $.response[200].random();
};
