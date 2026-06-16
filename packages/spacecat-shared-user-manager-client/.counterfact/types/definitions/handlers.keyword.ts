import type { handlers_KeywordID } from "./handlers.KeywordID.js";

export type handlers_Keyword = {
  id: handlers_KeywordID;
  /**
   * Tags max 5 tags are allowed, each tag can have max 50 characters
   */
  tags?: Array<string>;
};
