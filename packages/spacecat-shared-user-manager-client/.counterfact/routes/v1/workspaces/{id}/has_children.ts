import type { workspacesHasChildren } from "../../../../types/paths/v1/workspaces/{id}/has_children.types.js";

export const GET: workspacesHasChildren = async ($) => {
  return $.response[200].random();
};
