import type { adsConnectionUpdate } from "../../../../../../types/paths/v1/workspaces/{workspace_id}/connections/google-ads/{connection_id}.types.js";

export const PUT: adsConnectionUpdate = async ($) => {
  return $.response[200].empty();
};
