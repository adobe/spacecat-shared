import type { projectLimitsGet } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/limits.types.js";

export const GET: projectLimitsGet = async ($) => {
  return $.response[200].random();
};
