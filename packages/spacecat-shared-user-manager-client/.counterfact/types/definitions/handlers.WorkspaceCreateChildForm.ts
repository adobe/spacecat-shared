import type { handlers_WorkspaceResources } from "./handlers.WorkspaceResources.js";

export type handlers_WorkspaceCreateChildForm = {
  icon?: string;
  owner?: string;
  resources: handlers_WorkspaceResources;
  title: string;
};
