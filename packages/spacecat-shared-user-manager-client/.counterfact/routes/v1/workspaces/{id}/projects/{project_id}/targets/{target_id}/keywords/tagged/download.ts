import type { projectDownloadTaggedKeywords } from "../../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords/tagged/download.types.js";

export const GET: projectDownloadTaggedKeywords = async ($) => {
  return $.response[200].empty();
};
