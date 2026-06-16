import type { handlers_urlGroup } from "./handlers.urlGroup.js";

export type handlers_urlGroupsListResponse = {
  items?: Array<handlers_urlGroup>;
  page?: number;
  total?: number;
};
