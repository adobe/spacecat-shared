// LLMO-5616 stateful handler (do-not-clobber).
const nf = ($, m = "not found") => ($.response[404] ? $.response[404] : $.response[500]).json({ message: m });
export const GET = async ($) => {
  const b = $.context.getServiceUnitsBalance($.path.id);
  return b ? $.response[200].json(b) : nf($);
};
