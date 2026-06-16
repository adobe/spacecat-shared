import type { handlers_WorkspaceConnectionItem } from "./handlers.WorkspaceConnectionItem.js";

/**
 * Response for workspace connections
 */
export type handlers_WorkspaceConnectionsResponse = {
  items?: Array<handlers_WorkspaceConnectionItem>;
  page_number?: number;
  total_items?: number;
};
