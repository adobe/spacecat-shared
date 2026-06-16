import type { adminWorkspaceCreateMaster } from "../../../../types/paths/v1/admin/workspaces/master.types.js";

export const POST: adminWorkspaceCreateMaster = async ($) => {
  return $.response[200].random();
};
