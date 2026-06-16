import type { userProfileUpdateInternal } from "../../../../types/paths/v1/internal/users/{user_id}.types.js";

export const PUT: userProfileUpdateInternal = async ($) => {
  return $.response[200].random();
};
