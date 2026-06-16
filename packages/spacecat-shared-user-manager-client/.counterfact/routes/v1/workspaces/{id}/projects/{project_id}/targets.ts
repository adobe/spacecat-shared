import type { projectTargetDelete } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets.types.js";
import type { projectTargetListGet } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets.types.js";
import type { projectAddTarget } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets.types.js";

export const DELETE: projectTargetDelete = async ($) => {
  return $.response[200].random();
};

export const GET: projectTargetListGet = async ($) => {
  return $.response[200].random();
};

export const POST: projectAddTarget = async ($) => {
  return $.response[200].random();
};
