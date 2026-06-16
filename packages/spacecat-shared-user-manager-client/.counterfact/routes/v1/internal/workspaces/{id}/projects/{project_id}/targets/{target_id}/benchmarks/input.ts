import type { internalBenchmarksInput } from "../../../../../../../../../../types/paths/v1/internal/workspaces/{id}/projects/{project_id}/targets/{target_id}/benchmarks/input.types.js";

export const GET: internalBenchmarksInput = async ($) => {
  return $.response[200].random();
};
