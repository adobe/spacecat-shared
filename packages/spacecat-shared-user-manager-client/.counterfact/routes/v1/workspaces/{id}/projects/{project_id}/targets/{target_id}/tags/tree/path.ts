import type { projectFindTagsPath } from "../../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/tags/tree/path.types.js";

export const GET: projectFindTagsPath = async ($) => {
  return $.response[200].random();
};
