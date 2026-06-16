import type { workspaceChildCreateV2 } from "../../../../types/paths/v2/workspaces/{id}/child.types.js";

export const POST: workspaceChildCreateV2 = async ($) => {
  return $.response[200].random();
};
