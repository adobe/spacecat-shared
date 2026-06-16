import type { projectTargetListGetInternal } from "../../../../../../../types/paths/v1/internal/workspaces/{id}/projects/{project_id}/targets.types.js";

export const GET: projectTargetListGetInternal = async ($) => {
  return $.response[200].random();
};
