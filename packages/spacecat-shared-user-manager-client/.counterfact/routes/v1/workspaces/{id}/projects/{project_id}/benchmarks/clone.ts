import type { workspacesCloneBenchmarksTags } from "../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/benchmarks/clone.types.js";

export const POST: workspacesCloneBenchmarksTags = async ($) => {
  return $.response[200].empty();
};
