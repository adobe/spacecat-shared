import type { handlers_KeywordResponse } from "./handlers.KeywordResponse.js";

export type handlers_KeywordsResponse = {
  keywords?: Array<handlers_KeywordResponse>;
  page?: number;
  total?: number;
};
