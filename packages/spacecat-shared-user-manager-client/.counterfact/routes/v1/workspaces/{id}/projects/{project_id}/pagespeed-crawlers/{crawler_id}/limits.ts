import type { crawlerLimitsGet } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/pagespeed-crawlers/{crawler_id}/limits.types.js";

export const GET: crawlerLimitsGet = async ($) => {
  return $.response[200].random();
};
