import type { countries } from "../../types/paths/v1/countries.types.js";

export const GET: countries = async ($) => {
  return $.response[200].random();
};
