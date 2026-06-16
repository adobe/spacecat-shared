import type { serviceUnitsUsedSet } from "../../../../../../types/paths/v1/internal/workspaces/{id}/service-units/used.types.js";

export const PUT: serviceUnitsUsedSet = async ($) => {
  return $.response[204].empty();
};
