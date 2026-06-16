import type { keywordsTagsRelationsDelete } from "../../../../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/targets/{target_id}/keywords/relations.types.js";

export const DELETE: keywordsTagsRelationsDelete = async ($) => {
  return $.response[204].empty();
};
