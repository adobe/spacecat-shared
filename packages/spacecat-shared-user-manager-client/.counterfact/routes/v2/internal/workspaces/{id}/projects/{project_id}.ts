import type { internalProjectByIdV2 } from "../../../../../../types/paths/v2/internal/workspaces/{id}/projects/{project_id}.types.js";

export const GET: internalProjectByIdV2 = async ($) => {
  return $.response[200].random();
};
