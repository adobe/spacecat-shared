import type { locations } from "../../types/paths/v1/locations.types.js";

export const GET: locations = async ($) => {
  return $.response[401].random();
};
