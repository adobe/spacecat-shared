import type { handlers_tagTreeItem } from "./handlers.tagTreeItem.js";

export type handlers_tagTreeItem = {
  children?: Array<handlers_tagTreeItem>;
  children_count?: number;
  id?: string;
  keywords_count?: number;
  name?: string;
  parent_id?: string;
};
