import type { internalAllLiveTargets } from "../../../../types/paths/v1/internal/targets/all.types.js";

export const GET: internalAllLiveTargets = async ($) => {
  return $.response[200].random();
};
