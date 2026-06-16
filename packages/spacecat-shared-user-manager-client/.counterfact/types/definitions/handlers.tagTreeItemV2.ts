import type { handlers_tagTreeItemV2 } from "./handlers.tagTreeItemV2.js";

export type handlers_tagTreeItemV2 = {
  children?: Array<handlers_tagTreeItemV2>;
  id?: string;
  name?: string;
  parent_id?: string;
};
