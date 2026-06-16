import type { handlers_projectItem } from "./handlers.projectItem.js";

export type handlers_projectListResponse = {
  items?: Array<handlers_projectItem>;
  page?: number;
  total?: number;
};
