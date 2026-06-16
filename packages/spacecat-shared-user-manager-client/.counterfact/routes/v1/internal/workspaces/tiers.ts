import type { internalTiersList } from "../../../../types/paths/v1/internal/workspaces/tiers.types.js";

export const GET: internalTiersList = async ($) => {
  return $.response[200].random();
};
