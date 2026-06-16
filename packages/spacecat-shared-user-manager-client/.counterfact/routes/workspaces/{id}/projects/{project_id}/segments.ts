import type { projectSegmentCreate } from "../../../../../types/paths/workspaces/{id}/projects/{project_id}/segments.types.js";

export const POST: projectSegmentCreate = async ($) => {
  return $.response[201].random();
};
