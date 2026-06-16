import type { adminWorkspaceChildCreate } from "../../../types/paths/v1/admin/workspaces.types.js";

export const POST: adminWorkspaceChildCreate = async ($) => {
  return $.response[200].random();
};
