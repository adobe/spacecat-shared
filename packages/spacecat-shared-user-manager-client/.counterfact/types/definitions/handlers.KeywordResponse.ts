import type { handlers_KeywordID } from "./handlers.KeywordID.js";

export type handlers_KeywordResponse = {
  click_potential?: number;
  created_at?: string;
  difficulty100?: number;
  id: handlers_KeywordID;
  status?: string;
  /**
   * Tags max 5 tags are allowed, each tag can have max 50 characters
   */
  tags?: Array<string>;
  updated_at?: string;
  volume?: number;
};
