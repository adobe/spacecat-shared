import type { projectDownloadBenchmarks } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/benchmarks/download.types.js";

export const GET: projectDownloadBenchmarks = async ($) => {
  return $.response[200].empty();
};
