import type { keywordsPreferredUrlsDownload } from "../../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords/preferred-url/download.types.js";

export const GET: keywordsPreferredUrlsDownload = async ($) => {
  return $.response[200].empty();
};
