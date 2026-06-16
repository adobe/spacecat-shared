// LLMO-5616 stateful handler (do-not-clobber).
export const GET = async ($) => $.response[200].json($.context.getTotalResources());
