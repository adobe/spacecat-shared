import type { keywordslistsDelete } from "../../../../types/paths/v1/workspaces/{id}/keywordslists.types.js";
import type { keywordslistsGet } from "../../../../types/paths/v1/workspaces/{id}/keywordslists.types.js";
import type { keywordslistsPost } from "../../../../types/paths/v1/workspaces/{id}/keywordslists.types.js";

export const DELETE: keywordslistsDelete = async ($) => {
  return $.response[200].random();
};

export const GET: keywordslistsGet = async ($) => {
  return $.response[200].random();
};

export const POST: keywordslistsPost = async ($) => {
  return $.response[200].random();
};
