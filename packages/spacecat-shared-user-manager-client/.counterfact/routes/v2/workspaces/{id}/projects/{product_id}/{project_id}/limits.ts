import type { projectLimitsGetV2 } from "../../../../../../../types/paths/v2/workspaces/{id}/projects/{product_id}/{project_id}/limits.types.js";

export const GET: projectLimitsGetV2 = async ($) => {
  return $.response[200].random();
};
