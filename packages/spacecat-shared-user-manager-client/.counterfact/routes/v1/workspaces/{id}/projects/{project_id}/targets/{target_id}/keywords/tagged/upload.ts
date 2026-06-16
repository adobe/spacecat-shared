import type { projectUploadTaggedKeywords } from "../../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords/tagged/upload.types.js";

export const POST: projectUploadTaggedKeywords = async ($) => {
  return $.response[200].empty();
};
