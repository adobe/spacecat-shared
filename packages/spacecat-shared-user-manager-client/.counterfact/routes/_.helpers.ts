// LLMO-5616 shared route helpers. Underscore-prefixed = compiled by Counterfact
// but not served as a route (same convention as _.context.ts). Do-not-clobber.

// Not-found responder. 404 isn't declared on every path in the spec; fall back
// to 500 where it isn't so the handler never references an undefined response.
// eslint-disable-next-line import/prefer-default-export
export const nf = ($: any, m = "not found") =>
  ($.response[404] ? $.response[404] : $.response[500]).json({ message: m });
