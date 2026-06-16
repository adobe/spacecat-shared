import type { handlers_tagsList } from "./handlers.tagsList.js";

export type handlers_tagsListResponse = {
  items?: handlers_tagsList;
  page?: number;
  total?: number;
};
