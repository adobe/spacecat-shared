import type { projectTargetDetails } from "../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}.types.js";

export const GET: projectTargetDetails = async ($) => {
  return $.response[200].random();
};
