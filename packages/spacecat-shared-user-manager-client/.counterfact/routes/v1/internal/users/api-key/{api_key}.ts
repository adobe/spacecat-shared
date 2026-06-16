import type { userByApiKeyGetInternal } from "../../../../../types/paths/v1/internal/users/api-key/{api_key}.types.js";

export const GET: userByApiKeyGetInternal = async ($) => {
  return $.response[200].random();
};
