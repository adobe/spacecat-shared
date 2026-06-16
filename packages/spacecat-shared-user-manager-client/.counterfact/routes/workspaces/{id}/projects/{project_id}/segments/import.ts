import type { segmentsImport } from "../../../../../../types/paths/workspaces/{id}/projects/{project_id}/segments/import.types.js";

export const POST: segmentsImport = async ($) => {
  return $.response[200].random();
};
