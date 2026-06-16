import type { basicProfilesList } from "../../../../types/paths/v1/internal/users/basic.types.js";

export const GET: basicProfilesList = async ($) => {
  return $.response[200].random();
};
