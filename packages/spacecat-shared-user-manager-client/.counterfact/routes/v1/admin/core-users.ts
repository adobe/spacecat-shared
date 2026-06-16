import type { adminCoreUsersList } from "../../../types/paths/v1/admin/core-users.types.js";

export const GET: adminCoreUsersList = async ($) => {
  return $.response[200].random();
};
