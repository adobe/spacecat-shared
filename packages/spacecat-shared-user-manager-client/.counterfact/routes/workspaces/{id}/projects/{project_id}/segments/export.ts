import type { segmentsExport } from "../../../../../../types/paths/workspaces/{id}/projects/{project_id}/segments/export.types.js";

export const GET: segmentsExport = async ($) => {
  return $.response[200].random();
};
