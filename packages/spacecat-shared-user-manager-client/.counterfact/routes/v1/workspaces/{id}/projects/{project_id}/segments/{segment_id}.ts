import type { projectSegmentsGet } from "../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/segments/{segment_id}.types.js";
import type { projectSegmentUpdate } from "../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/segments/{segment_id}.types.js";

export const GET: projectSegmentsGet = async ($) => {
  return $.response[200].random();
};

export const PUT: projectSegmentUpdate = async ($) => {
  return $.response[200].random();
};
