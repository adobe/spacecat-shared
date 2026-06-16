import type { projectListGetForUser } from "../../../../types/paths/v1/workspaces/{id}/projects.types.js";
import type { projectCreate } from "../../../../types/paths/v1/workspaces/{id}/projects.types.js";

export const GET: projectListGetForUser = async ($) => {
  return $.response[200].random();
};

export const POST: projectCreate = async ($) => {
  return $.response[200].random();
};
