import type { projectUpdateKeywords } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords/preferred-url.types.js";
import type { keywordsPreferredUrlsUpload } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords/preferred-url.types.js";

export const PATCH: projectUpdateKeywords = async ($) => {
  return $.response[200].random();
};

export const POST: keywordsPreferredUrlsUpload = async ($) => {
  return $.response[200].random();
};
