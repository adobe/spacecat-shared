// LLMO-5616 non-spec control route for tests/local dev (do-not-clobber).
// Seeds the provisioning status sequence a workspace's GET /v1/workspaces/{id}/status
// walks through (one entry consumed per call) so the poll path can be exercised
// deterministically. Body: { id, statuses: string[] }.
import { nf } from "./_.helpers.js";

export const POST = async ($) => {
  const body = $.body ?? {};
  const ok = $.context.setStatusSequence(body.id, body.statuses ?? []);
  return ok ? $.response[200].json({ ok: true }) : nf($, "workspace not found");
};
