// LLMO-5616 stateful handler — DEPRECATED, aliases /resources (do-not-clobber).
import { nf } from "../../../_.helpers.js";

export const GET = async ($) => {
  const r = $.context.getResources($.path.id);
  return r ? $.response[200].json(r) : nf($);
};
