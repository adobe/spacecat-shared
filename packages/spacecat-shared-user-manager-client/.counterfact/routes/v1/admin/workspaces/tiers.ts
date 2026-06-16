import type { activationPanelTiersList } from "../../../../types/paths/v1/admin/workspaces/tiers.types.js";

export const GET: activationPanelTiersList = async ($) => {
  return $.response[200].random();
};
