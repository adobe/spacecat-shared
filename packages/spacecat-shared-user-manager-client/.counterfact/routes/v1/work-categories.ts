import type { workCategories } from "../../types/paths/v1/work-categories.types.js";

export const GET: workCategories = async ($) => {
  return $.response[200].random();
};
