// LLMO-5616 stateful handler (do-not-clobber).
// Returns the provisioning status as a single object ({ status }) — matching the
// overlay CR2 contract. Reports the terminal "created" for a seeded/created
// workspace, or walks a seeded sequence (see /__set-status-sequence) so the
// provisioning poll path is deterministic; 404/500 for an unknown workspace.
import { nf } from "../../../_.helpers.js";

export const GET = async ($) => {
  const status = $.context.getStatus($.path.id);
  return status ? $.response[200].json(status) : nf($, "workspace not found");
};
