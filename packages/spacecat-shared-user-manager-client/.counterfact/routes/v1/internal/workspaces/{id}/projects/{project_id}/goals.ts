import type { internalGoalsList } from "../../../../../../../types/paths/v1/internal/workspaces/{id}/projects/{project_id}/goals.types.js";

export const GET: internalGoalsList = async ($) => {
  return $.response[200].random();
};
