import type { adminEsProjectDelete } from "../../../../../../types/paths/v1/admin/workspaces/{id}/projects/{project_id}.types.js";

export const DELETE: adminEsProjectDelete = async ($) => {
  return $.response[200].random();
};
