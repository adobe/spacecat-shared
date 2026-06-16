import type { keywordslistsDatabasesGet } from "../../../../../types/paths/v1/workspaces/{id}/keywordslists/databases.types.js";

export const GET: keywordslistsDatabasesGet = async ($) => {
  return $.response[200].random();
};
