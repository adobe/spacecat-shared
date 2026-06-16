import type { HTTP_POST } from "../../../../../../types/paths/workspaces/{id}/projects/{project_id}/segments/copy-all-from.types.js";

export const POST: HTTP_POST = async ($) => {
  return $.response[200].random();
};
