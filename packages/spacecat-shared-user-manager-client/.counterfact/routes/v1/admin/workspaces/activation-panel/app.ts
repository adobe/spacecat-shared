import type { activationPanelSpa } from "../../../../../types/paths/v1/admin/workspaces/activation-panel/app.types.js";

export const GET: activationPanelSpa = async ($) => {
  return $.response[200].random();
};
