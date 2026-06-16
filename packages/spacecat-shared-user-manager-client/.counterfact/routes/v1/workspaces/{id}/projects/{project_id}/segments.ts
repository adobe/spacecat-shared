import type { projectSegmentDelete } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/segments.types.js";
import type { projectSegmentListGet } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/segments.types.js";

export const DELETE: projectSegmentDelete = async ($) => {
  return $.response[204].empty();
};

export const GET: projectSegmentListGet = async ($) => {
  return $.response[200].random();
};
