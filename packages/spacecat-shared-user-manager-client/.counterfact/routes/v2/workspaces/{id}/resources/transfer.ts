// LLMO-5616 stateful handler (do-not-clobber).
// Reflects a resource transfer onto {id} in the store and returns the updated
// allocation, so a subsequent GET /v1/workspaces/{id}/resources sees it;
// 404/500 for an unknown workspace.
import { nf } from "../../../../_.helpers.js";

export const POST = async ($) => {
  const result = $.context.transferResources($.path.id, $.body ?? {});
  return result ? $.response[200].json(result) : nf($, "workspace not found");
};
