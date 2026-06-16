// LLMO-5616 stateful handler — DEPRECATED, aliases /resources (do-not-clobber).
export const GET = async ($) => $.response[200].json($.context.getTotalResources());
