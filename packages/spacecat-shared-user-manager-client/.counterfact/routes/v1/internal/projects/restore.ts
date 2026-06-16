import type { internalRestoreProject } from "../../../../types/paths/v1/internal/projects/restore.types.js";

export const POST: internalRestoreProject = async ($) => {
  return $.response[204].empty();
};
