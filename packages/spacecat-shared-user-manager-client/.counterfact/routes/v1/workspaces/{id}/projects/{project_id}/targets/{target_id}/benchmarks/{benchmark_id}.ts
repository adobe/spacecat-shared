import type { projectUpdateBenchmarks } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/benchmarks/{benchmark_id}.types.js";

export const PUT: projectUpdateBenchmarks = async ($) => {
  return $.response[200].random();
};
