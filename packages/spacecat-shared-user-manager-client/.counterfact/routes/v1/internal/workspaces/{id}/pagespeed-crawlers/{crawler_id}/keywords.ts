import type { pagespeedInternalKeywordsList } from "../../../../../../../types/paths/v1/internal/workspaces/{id}/pagespeed-crawlers/{crawler_id}/keywords.types.js";

export const GET: pagespeedInternalKeywordsList = async ($) => {
  return $.response[200].random();
};
