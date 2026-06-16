import type { internalLiveProjectsTargetListGet } from "../../../../../../types/paths/v1/internal/workspaces/{id}/projects/targets.types.js";

export const GET: internalLiveProjectsTargetListGet = async ($) => {
  return $.response[200].random();
};
