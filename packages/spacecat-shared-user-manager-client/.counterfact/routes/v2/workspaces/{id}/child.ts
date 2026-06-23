// LLMO-5616 stateful handler (do-not-clobber).
// Registers a sub-workspace under {id} and returns it with a deterministic id
// (ws-new-N) and the posted title/body, so the provisioning flow can use the id
// downstream (status poll, resource transfer). Mirrors the v1 child handler.
export const POST = async ($) => {
  const ws = $.context.createChild($.path.id, $.body ?? {});
  return $.response[200].json(ws);
};
