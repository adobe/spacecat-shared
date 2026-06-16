import type { activationPanelCheckOwnerEmail } from "../../../../../../types/paths/v1/admin/workspaces/api/users/{email}.types.js";

export const GET: activationPanelCheckOwnerEmail = async ($) => {
  return $.response[200].random();
};
