import type { projectBulkUpdateBenchmarks } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/benchmarks/bulk.types.js";

export const PUT: projectBulkUpdateBenchmarks = async ($) => {
  return $.response[200].random();
};
