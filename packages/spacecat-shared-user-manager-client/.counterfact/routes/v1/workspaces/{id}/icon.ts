import type { workspaceUpdateIcon } from "../../../../types/paths/v1/workspaces/{id}/icon.types.js";

export const PUT: workspaceUpdateIcon = async ($) => {
  return $.response[204].empty();
};
