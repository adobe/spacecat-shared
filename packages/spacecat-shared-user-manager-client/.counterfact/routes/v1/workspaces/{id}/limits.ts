// LLMO-5616 stateful handler — DEPRECATED, aliases /resources (do-not-clobber).
const nf = ($, m = "not found") => ($.response[404] ? $.response[404] : $.response[500]).json({ message: m });
export const GET = async ($) => {
  const r = $.context.getResources($.path.id);
  return r ? $.response[200].json(r) : nf($);
};
