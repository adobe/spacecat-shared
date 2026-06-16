import type { internalProjectSegmentListGet } from "../../../../../../../types/paths/v1/internal/workspaces/{id}/projects/{project_id}/segments.types.js";

export const GET: internalProjectSegmentListGet = async ($) => {
  return $.response[200].random();
};
