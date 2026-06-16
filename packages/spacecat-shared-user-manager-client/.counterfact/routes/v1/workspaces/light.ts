import type { workspacesLightList } from "../../../types/paths/v1/workspaces/light.types.js";

export const GET: workspacesLightList = async ($) => {
  return $.response[200].random();
};
