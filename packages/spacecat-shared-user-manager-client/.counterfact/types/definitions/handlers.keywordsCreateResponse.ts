import type { handlers_keyword } from "./handlers.keyword.js";

export type handlers_keywordsCreateResponse = {
  duplicate_count?: number;
  items?: Array<handlers_keyword>;
};
