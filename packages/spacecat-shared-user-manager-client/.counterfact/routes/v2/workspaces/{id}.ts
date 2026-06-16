// LLMO-5616 stateful handler (do-not-clobber).
const nf = ($, m = "not found") => ($.response[404] ? $.response[404] : $.response[500]).json({ message: m });
export const GET = async ($) => {
  const ws = $.context.getWorkspace($.path.id);
  return ws ? $.response[200].json(ws) : nf($);
};
