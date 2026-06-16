import type { pagespeedInternalUrlsList } from "../../../../../../../types/paths/v1/internal/workspaces/{id}/pagespeed-crawlers/{crawler_id}/urls.types.js";

export const GET: pagespeedInternalUrlsList = async ($) => {
  return $.response[200].random();
};
