import type { handlers_WorkspaceConnectionOwner } from "./handlers.WorkspaceConnectionOwner.js";
import type { handlers_WorkspaceConnectionProject } from "./handlers.WorkspaceConnectionProject.js";
import type { handlers_WorkspaceConnectionSettings } from "./handlers.WorkspaceConnectionSettings.js";
import type { handlers_WorkspaceConnectionStatus } from "./handlers.WorkspaceConnectionStatus.js";

/**
 * A connection for a particular workspace
 */
export type handlers_WorkspaceConnection = {
  data_source?: string;
  id?: number;
  owner?: handlers_WorkspaceConnectionOwner;
  projects?: Array<handlers_WorkspaceConnectionProject>;
  settings?: handlers_WorkspaceConnectionSettings;
  status?: handlers_WorkspaceConnectionStatus;
  updated_at?: string;
};
