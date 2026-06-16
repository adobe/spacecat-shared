import type { internalProjectsListV2 } from "../../../../../types/paths/v2/internal/workspaces/{id}/projects.types.js";

export const GET: internalProjectsListV2 = async ($) => {
  return $.response[200].random();
};
