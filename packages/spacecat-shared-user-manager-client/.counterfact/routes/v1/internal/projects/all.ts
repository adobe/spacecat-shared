import type { internalProjectAllList } from "../../../../types/paths/v1/internal/projects/all.types.js";

export const GET: internalProjectAllList = async ($) => {
  return $.response[200].random();
};
