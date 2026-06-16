import type { userOwnershipEligibility } from "../../../types/paths/v1/users/workspace-ownership-eligibility.types.js";

export const GET: userOwnershipEligibility = async ($) => {
  return $.response[200].random();
};
