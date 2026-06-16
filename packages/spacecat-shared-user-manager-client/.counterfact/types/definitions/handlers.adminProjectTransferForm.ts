import type { handlers_transferProductProject } from "./handlers.transferProductProject.js";

export type handlers_adminProjectTransferForm = {
  projects: Array<handlers_transferProductProject>;
  target_workspace_id: string;
  target_workspace_owner_id: number;
};
