import type { pagespeedDelete } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/pagespeed-crawlers.types.js";
import type { pagespeedList } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/pagespeed-crawlers.types.js";
import type { pagespeedCreate } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/pagespeed-crawlers.types.js";

export const DELETE: pagespeedDelete = async ($) => {
  return $.response[200].random();
};

export const GET: pagespeedList = async ($) => {
  return $.response[200].random();
};

export const POST: pagespeedCreate = async ($) => {
  return $.response[200].random();
};
