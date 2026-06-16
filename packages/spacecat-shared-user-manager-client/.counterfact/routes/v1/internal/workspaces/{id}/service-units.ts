import type { serviceUnitsGet } from "../../../../../types/paths/v1/internal/workspaces/{id}/service-units.types.js";
import type { serviceUnitsSet } from "../../../../../types/paths/v1/internal/workspaces/{id}/service-units.types.js";

export const GET: serviceUnitsGet = async ($) => {
  return $.response[200].random();
};

export const PUT: serviceUnitsSet = async ($) => {
  return $.response[204].empty();
};
