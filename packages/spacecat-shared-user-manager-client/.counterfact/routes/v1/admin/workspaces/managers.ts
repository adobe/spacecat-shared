import type { workspaceManagerImport } from "../../../../types/paths/v1/admin/workspaces/managers.types.js";

export const POST: workspaceManagerImport = async ($) => {
  return $.response[200].random();
};
