import type { internalCoreUsersList } from "../../../types/paths/v1/internal/core-users.types.js";

export const GET: internalCoreUsersList = async ($) => {
  return $.response[200].random();
};
