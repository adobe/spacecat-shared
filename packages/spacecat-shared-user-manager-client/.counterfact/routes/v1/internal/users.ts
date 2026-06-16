import type { profilesList } from "../../../types/paths/v1/internal/users.types.js";

export const GET: profilesList = async ($) => {
  return $.response[200].random();
};
