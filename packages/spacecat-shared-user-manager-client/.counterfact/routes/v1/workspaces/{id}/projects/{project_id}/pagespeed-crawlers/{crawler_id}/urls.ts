import type { pagespeedDeleteUrls } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/pagespeed-crawlers/{crawler_id}/urls.types.js";
import type { pagespeedUrlsList } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/pagespeed-crawlers/{crawler_id}/urls.types.js";
import type { pagespeedAddUrls } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/pagespeed-crawlers/{crawler_id}/urls.types.js";

export const DELETE: pagespeedDeleteUrls = async ($) => {
  return $.response[200].random();
};

export const GET: pagespeedUrlsList = async ($) => {
  return $.response[200].random();
};

export const POST: pagespeedAddUrls = async ($) => {
  return $.response[200].random();
};
