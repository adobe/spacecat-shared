import type { adsConnectionCreate } from "../../../../../types/paths/v1/workspaces/{workspace_id}/connections/google-ads.types.js";

export const POST: adsConnectionCreate = async ($) => {
  return $.response[201].empty();
};
