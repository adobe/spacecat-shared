import type { tiersList } from "../../../types/paths/v1/workspaces/tiers.types.js";

export const GET: tiersList = async ($) => {
  return $.response[200].random();
};
