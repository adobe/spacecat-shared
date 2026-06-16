import type { handlers_WorkspaceConnectionOwner } from "./handlers.WorkspaceConnectionOwner.js";
import type { handlers_InternalWorkspaceConnectionSettings } from "./handlers.InternalWorkspaceConnectionSettings.js";
import type { handlers_WorkspaceConnectionStatus } from "./handlers.WorkspaceConnectionStatus.js";

/**
 * A connection for a particular workspace (internal)
 */
export type handlers_InternalWorkspaceConnectionDetails = {
  data_source?: string;
  id?: number;
  owner?: handlers_WorkspaceConnectionOwner;
  project_ids?: Array<string>;
  settings?: handlers_InternalWorkspaceConnectionSettings;
  status?: handlers_WorkspaceConnectionStatus;
  updated_at?: string;
};
