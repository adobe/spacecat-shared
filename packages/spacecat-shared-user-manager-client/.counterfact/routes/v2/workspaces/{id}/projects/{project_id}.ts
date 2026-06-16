import type { projectUpdateV2 } from "../../../../../types/paths/v2/workspaces/{id}/projects/{project_id}.types.js";

export const PUT: projectUpdateV2 = async ($) => {
  return $.response[200].random();
};
