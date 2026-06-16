// LLMO-5616 stateful handler — uses $.context (root Context singleton). Do-not-clobber.
import type { userProfile } from "../../types/paths/v1/profile.types.js";
import type { userProfileUpdate } from "../../types/paths/v1/profile.types.js";

export const GET: userProfile = async ($) => $.response[200].json($.context.getProfile());

export const POST: userProfileUpdate = async ($) => {
  $.context.updateProfile(($.body as Record<string, unknown>) ?? {});
  return $.response[200].json($.context.getProfile());
};
