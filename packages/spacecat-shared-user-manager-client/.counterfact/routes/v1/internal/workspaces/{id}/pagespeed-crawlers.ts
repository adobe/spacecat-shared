import type { pagespeedInternalList } from "../../../../../types/paths/v1/internal/workspaces/{id}/pagespeed-crawlers.types.js";

export const GET: pagespeedInternalList = async ($) => {
  return $.response[200].random();
};
