import type { languages } from "../../types/paths/v1/languages.types.js";

export const GET: languages = async ($) => {
  return $.response[200].random();
};
