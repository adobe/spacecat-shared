import type { goalsMetricsList } from "../../../types/paths/v1/goals/metrics.types.js";

export const GET: goalsMetricsList = async ($) => {
  return $.response[200].random();
};
