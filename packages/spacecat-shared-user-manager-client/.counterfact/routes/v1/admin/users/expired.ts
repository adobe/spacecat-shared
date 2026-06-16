import type { expiredSubscriptionUsers } from "../../../../types/paths/v1/admin/users/expired.types.js";

export const GET: expiredSubscriptionUsers = async ($) => {
  return $.response[200].random();
};
