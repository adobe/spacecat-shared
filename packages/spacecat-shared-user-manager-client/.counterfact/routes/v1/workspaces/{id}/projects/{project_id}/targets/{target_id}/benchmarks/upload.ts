import type { projectUploadBenchmarks } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/benchmarks/upload.types.js";

export const POST: projectUploadBenchmarks = async ($) => {
  return $.response[200].empty();
};
