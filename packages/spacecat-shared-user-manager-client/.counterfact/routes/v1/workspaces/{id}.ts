// LLMO-5616 stateful handler (do-not-clobber).
import { nf } from "../../_.helpers.js";

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
