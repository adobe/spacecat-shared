// LLMO-5616 stateful handler (do-not-clobber).
import { nf } from "../../../../_.helpers.js";

export const GET = async ($) => {
  const b = $.context.getServiceUnitsBalance($.path.id);
  return b ? $.response[200].json(b) : nf($);
};
