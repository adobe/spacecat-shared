import type { workspaceConnectionDetachProject } from "../../../../../../../types/paths/v1/workspaces/{workspace_id}/connections/{connection_id}/projects/{project_id}.types.js";
import type { workspaceConnectionAttachProject } from "../../../../../../../types/paths/v1/workspaces/{workspace_id}/connections/{connection_id}/projects/{project_id}.types.js";

export const DELETE: workspaceConnectionDetachProject = async ($) => {
  return $.response[200].empty();
};

export const POST: workspaceConnectionAttachProject = async ($) => {
  return $.response[200].empty();
};
