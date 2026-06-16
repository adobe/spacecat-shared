import type { setProjectFavourite } from "../../../../../../types/paths/v1/workspaces/{id}/projects/{project_id}/favourite.types.js";

export const POST: setProjectFavourite = async ($) => {
  return $.response[200].empty();
};
