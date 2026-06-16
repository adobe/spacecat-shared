import type { internalPublicProjectSegmentListGet } from "../../../../../../../../types/paths/v1/internal/workspaces/{id}/projects/{project_id}/public/segments.types.js";

export const GET: internalPublicProjectSegmentListGet = async ($) => {
  return $.response[200].random();
};
