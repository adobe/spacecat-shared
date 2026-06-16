import type { internalProjectSegmentsGet } from "../../../../../../../../types/paths/v1/internal/workspaces/{id}/projects/{project_id}/segments/{segment_id}.types.js";

export const GET: internalProjectSegmentsGet = async ($) => {
  return $.response[200].random();
};
