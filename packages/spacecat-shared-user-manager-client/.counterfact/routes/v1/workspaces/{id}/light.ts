import type { workspaceLightDetails } from "../../../../types/paths/v1/workspaces/{id}/light.types.js";

export const GET: workspaceLightDetails = async ($) => {
  return $.response[200].random();
};
