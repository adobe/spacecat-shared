// LLMO-5616 stateful handler (do-not-clobber).
import { nf } from "../../../_.helpers.js";

export const GET = async ($) => $.response[200].json($.context.listMembers($.path.id));
export const POST = async ($) => {
  const body = $.body ?? {};
  const members = Array.isArray(body) ? body : (body.members ?? [body]);
  const res = $.context.addMembers($.path.id, members);
  return res ? $.response[200].json(res) : nf($, "workspace not found");
};
export const PATCH = async ($) => {
  const body = $.body ?? {};
  const updated = $.context.updateMember($.path.id, body.user_id, body);
  return updated ? $.response[200].json(updated) : nf($, "member not found");
};
export const DELETE = async ($) => {
  const body = $.body ?? {};
  const ids = body.user_ids ?? (body.user_id ? [body.user_id] : []);
  // null = workspace missing (404/500); a number = members actually removed
  // (0 is valid — spec returns "number of user units freed", 0 means none).
  const removed = $.context.deleteMembers($.path.id, ids);
  return removed === null
    ? nf($, "workspace not found")
    : $.response[200].json({ deleted: true, count: removed });
};
