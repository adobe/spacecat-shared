import type { usersCreate } from "../../../types/paths/v1/admin/users.types.js";

export const POST: usersCreate = async ($) => {
  return $.response[201].empty();
};
