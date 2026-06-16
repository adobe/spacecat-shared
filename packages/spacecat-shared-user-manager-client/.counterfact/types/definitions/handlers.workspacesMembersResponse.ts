import type { handlers_WorkspaceMember } from "./handlers.WorkspaceMember.js";

export type handlers_workspacesMembersResponse = {
  items?: Array<handlers_WorkspaceMember>;
  page?: number;
  total?: number;
};
