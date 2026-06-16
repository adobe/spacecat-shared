import type { projectsListV2 } from "../../../../types/paths/v2/workspaces/{id}/projects.types.js";
import type { projectCreateV2 } from "../../../../types/paths/v2/workspaces/{id}/projects.types.js";

export const GET: projectsListV2 = async ($) => {
  return $.response[200].random();
};

export const POST: projectCreateV2 = async ($) => {
  return $.response[201].random();
};
