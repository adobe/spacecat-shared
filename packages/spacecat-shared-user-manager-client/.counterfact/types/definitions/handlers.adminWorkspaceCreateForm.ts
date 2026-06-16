import type { handlers_WorkspaceResources } from "./handlers.WorkspaceResources.js";

export type handlers_adminWorkspaceCreateForm = {
  icon?: string;
  owner_email?: string;
  parent_id: string;
  resources: handlers_WorkspaceResources;
  title: string;
};
