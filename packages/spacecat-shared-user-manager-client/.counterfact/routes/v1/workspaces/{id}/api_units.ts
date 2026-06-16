import type { workspaceApiUnitsGet } from "../../../../types/paths/v1/workspaces/{id}/api_units.types.js";

export const GET: workspaceApiUnitsGet = async ($) => {
  return $.response[200].random();
};
