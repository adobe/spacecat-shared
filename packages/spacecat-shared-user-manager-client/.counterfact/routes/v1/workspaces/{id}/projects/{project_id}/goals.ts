import type { goalsDelete } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/goals.types.js";
import type { goalsList } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/goals.types.js";
import type { goalCreate } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/goals.types.js";

export const DELETE: goalsDelete = async ($) => {
  return $.response[200].random();
};

export const GET: goalsList = async ($) => {
  return $.response[200].random();
};

export const POST: goalCreate = async ($) => {
  return $.response[200].random();
};
