import type { handlers_member } from "./handlers.member.js";

export type handlers_projectMembersResponse = {
  items?: Array<handlers_member>;
  page?: number;
  total?: number;
};
