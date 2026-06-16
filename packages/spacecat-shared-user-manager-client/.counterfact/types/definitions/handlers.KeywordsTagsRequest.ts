import type { handlers_KeywordID } from "./handlers.KeywordID.js";

export type handlers_KeywordsTagsRequest = {
  keyword_ids: Array<handlers_KeywordID>;
  tags: Array<string>;
};
