import type { consoleConnectionUpdate } from "../../../../../../types/paths/v1/workspaces/{workspace_id}/connections/google-console/{connection_id}.types.js";

export const PUT: consoleConnectionUpdate = async ($) => {
  return $.response[200].empty();
};
