import type { projectDeleteBenchmarks } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/benchmarks.types.js";
import type { benchmarksList } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/benchmarks.types.js";
import type { projectAddBenchmarks } from "../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/benchmarks.types.js";

export const DELETE: projectDeleteBenchmarks = async ($) => {
  return $.response[200].random();
};

export const GET: benchmarksList = async ($) => {
  return $.response[200].random();
};

export const POST: projectAddBenchmarks = async ($) => {
  return $.response[200].random();
};
