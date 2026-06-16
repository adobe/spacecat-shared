import type { internalProductWorkspacesGet } from "../../../../../types/paths/v2/internal/products/{product_id}/workspaces.types.js";

export const GET: internalProductWorkspacesGet = async ($) => {
  return $.response[200].random();
};
