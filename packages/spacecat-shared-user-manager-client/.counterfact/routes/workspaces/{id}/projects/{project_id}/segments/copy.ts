import type { segmentsCopyToProjects } from "../../../../../../types/paths/workspaces/{id}/projects/{project_id}/segments/copy.types.js";

export const POST: segmentsCopyToProjects = async ($) => {
  return $.response[200].random();
};
