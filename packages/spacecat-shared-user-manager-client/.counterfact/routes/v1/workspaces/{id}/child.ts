// LLMO-5616 stateful handler (do-not-clobber).
export const POST = async ($) => {
  const ws = $.context.createChild($.path.id, $.body ?? {});
  return $.response[200].json(ws);
};
