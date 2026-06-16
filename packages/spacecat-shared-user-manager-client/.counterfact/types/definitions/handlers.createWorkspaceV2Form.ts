import type { handlers_createWorkspaceV2Resources } from "./handlers.createWorkspaceV2Resources.js";

export type handlers_createWorkspaceV2Form = {
  icon?: string;
  owner?: string;
  parentID?: string;
  resources: handlers_createWorkspaceV2Resources;
  title: string;
  userID?: number;
};
