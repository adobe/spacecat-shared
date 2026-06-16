import type { projectRemoveTagsBenchmarks } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/benchmarks/remove-tags.types.js";

export const DELETE: projectRemoveTagsBenchmarks = async ($) => {
  return $.response[200].random();
};
