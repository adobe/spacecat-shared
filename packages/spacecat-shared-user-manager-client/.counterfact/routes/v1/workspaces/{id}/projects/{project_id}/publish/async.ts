import type { projectPublishAsync } from "../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/publish/async.types.js";

export const POST: projectPublishAsync = async ($) => {
  return $.response[200].empty();
};
