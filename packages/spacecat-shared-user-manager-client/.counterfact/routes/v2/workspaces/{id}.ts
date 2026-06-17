// LLMO-5616 stateful handler (do-not-clobber).
import { nf } from "../../_.helpers.js";

export const GET = async ($) => {
  const ws = $.context.getWorkspace($.path.id);
  return ws ? $.response[200].json(ws) : nf($);
};
