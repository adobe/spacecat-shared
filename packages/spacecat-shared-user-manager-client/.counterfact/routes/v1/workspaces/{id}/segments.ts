import type { workspaceSegmentListGet } from "../../../../types/paths/v1/workspaces/{id}/segments.types.js";

export const GET: workspaceSegmentListGet = async ($) => {
  return $.response[200].random();
};
