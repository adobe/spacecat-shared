import type { internalAllEsUsers } from "../../../../types/paths/v1/internal/users/all.types.js";

export const GET: internalAllEsUsers = async ($) => {
  return $.response[200].random();
};
