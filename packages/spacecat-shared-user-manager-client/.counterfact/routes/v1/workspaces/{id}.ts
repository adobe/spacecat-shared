// LLMO-5616 stateful handler (do-not-clobber).
const nf = ($, m = "not found") => ($.response[404] ? $.response[404] : $.response[500]).json({ message: m });
export const GET = async ($) => {
  const ws = $.context.getWorkspace($.path.id);
  return ws ? $.response[200].json(ws) : nf($);
};
export const PUT = async ($) => {
  const ws = $.context.updateWorkspace($.path.id, $.body ?? {});
  return ws ? $.response[200].json(ws) : nf($);
};
export const DELETE = async ($) => {
  const ok = $.context.deleteWorkspace($.path.id);
  return ok ? $.response[200].json({ deleted: true }) : nf($);
};
