import type { handlers_WorkspaceListItem } from "./handlers.WorkspaceListItem.js";

export type handlers_workspacesListResponse = {
  items?: Array<handlers_WorkspaceListItem>;
  page?: number;
  total?: number;
};
