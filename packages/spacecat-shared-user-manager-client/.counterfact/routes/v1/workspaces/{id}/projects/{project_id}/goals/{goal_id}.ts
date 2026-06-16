import type { goalUpdate } from "../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/goals/{goal_id}.types.js";

export const PUT: goalUpdate = async ($) => {
  return $.response[200].random();
};
