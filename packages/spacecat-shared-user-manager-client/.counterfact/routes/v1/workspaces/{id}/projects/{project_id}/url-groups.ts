import type { urlGroupsDelete } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/url-groups.types.js";
import type { urlGroupsList } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/url-groups.types.js";
import type { urlGroupsCreate } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/url-groups.types.js";

export const DELETE: urlGroupsDelete = async ($) => {
  return $.response[200].random();
};

export const GET: urlGroupsList = async ($) => {
  return $.response[200].random();
};

export const POST: urlGroupsCreate = async ($) => {
  return $.response[200].random();
};
