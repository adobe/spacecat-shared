import type { handlers_tagWithSearchResponse } from "./handlers.tagWithSearchResponse.js";

export type handlers_tagsListWithSearchResponse = {
  items?: Array<handlers_tagWithSearchResponse>;
  page?: number;
  total?: number;
};
