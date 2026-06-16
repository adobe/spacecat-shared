import type { internalProductProjectsFind } from "../../../../../../../types/paths/v2/internal/workspaces/{id}/products/{product_id}/projects.types.js";

export const GET: internalProductProjectsFind = async ($) => {
  return $.response[200].random();
};
