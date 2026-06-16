import type { pagespeedDeleteKeywords } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/pagespeed-crawlers/{crawler_id}/keywords.types.js";
import type { pagespeedKeywordsList } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/pagespeed-crawlers/{crawler_id}/keywords.types.js";
import type { pagespeedAddKeywords } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/pagespeed-crawlers/{crawler_id}/keywords.types.js";

export const DELETE: pagespeedDeleteKeywords = async ($) => {
  return $.response[200].random();
};

export const GET: pagespeedKeywordsList = async ($) => {
  return $.response[200].random();
};

export const POST: pagespeedAddKeywords = async ($) => {
  return $.response[200].random();
};
