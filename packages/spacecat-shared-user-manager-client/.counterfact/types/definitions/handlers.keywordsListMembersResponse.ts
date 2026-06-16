import type { handlers_member } from "./handlers.member.js";

export type handlers_keywordsListMembersResponse = {
  items?: Array<handlers_member>;
  page?: number;
  total?: number;
};
