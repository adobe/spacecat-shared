import type { usersRequiredUnits } from "../../../types/paths/v1/users/required-units.types.js";

export const POST: usersRequiredUnits = async ($) => {
  return $.response[200].random();
};
