import type { internalProjectsAllV2List } from "../../../../../types/paths/v2/internal/workspaces/projects/all.types.js";

export const GET: internalProjectsAllV2List = async ($) => {
  return $.response[200].random();
};
