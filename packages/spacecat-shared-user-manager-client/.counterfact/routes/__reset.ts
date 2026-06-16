// LLMO-5616 non-spec reset endpoint for tests/local dev (do-not-clobber).
export const POST = async ($) => {
  $.context.reset();
  return $.response[200].json({ reset: true });
};
