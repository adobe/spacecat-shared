import type { liveProjectsTargetListGet } from "../../../../../types/paths/v1/workspaces/{id}/projects/targets.types.js";

export const GET: liveProjectsTargetListGet = async ($) => {
  return $.response[200].random();
};
