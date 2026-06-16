import type { consoleConnectionCreate } from "../../../../../types/paths/v1/workspaces/{workspace_id}/connections/google-console.types.js";

export const POST: consoleConnectionCreate = async ($) => {
  return $.response[201].empty();
};
