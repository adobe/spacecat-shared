import type { discardDraftProject } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/discard_draft.types.js";

export const POST: discardDraftProject = async ($) => {
  return $.response[200].empty();
};
