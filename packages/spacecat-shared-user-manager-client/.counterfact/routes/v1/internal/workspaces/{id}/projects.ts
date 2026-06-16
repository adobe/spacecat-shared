import type { projectListGet } from "../../../../../types/paths/v1/internal/workspaces/{id}/projects.types.js";

export const GET: projectListGet = async ($) => {
  return $.response[200].random();
};
