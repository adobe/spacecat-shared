import type { handlers_KeywordID } from "./handlers.KeywordID.js";

export type handlers_KeywordsTagsUpdateRequest = {
  keyword_id: handlers_KeywordID;
  /**
   * TagsCreate max 5 tags are allowed, each tag can have max 50 characters
   */
  tags_create?: Array<string>;
  /**
   * TagsDelete max 5 tags are allowed, each tag can have max 50 characters
   */
  tags_delete?: Array<string>;
};
