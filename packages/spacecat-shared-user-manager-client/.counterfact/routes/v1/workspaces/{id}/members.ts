// LLMO-5616 stateful handler (do-not-clobber).
const nf = ($, m = "not found") => ($.response[404] ? $.response[404] : $.response[500]).json({ message: m });
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
  const ok = $.context.deleteMembers($.path.id, ids);
  return ok ? $.response[200].json({ deleted: true }) : nf($, "workspace not found");
};
