import type { activationPanelAioSettingsGet } from "../../../../../../../../types/paths/v1/admin/workspaces/api/workspaces/{id}/aio/prompt-settings.types.js";
import type { activationPanelAioSettingsUpsert } from "../../../../../../../../types/paths/v1/admin/workspaces/api/workspaces/{id}/aio/prompt-settings.types.js";

export const GET: activationPanelAioSettingsGet = async ($) => {
  return $.response[200].random();
};

export const PUT: activationPanelAioSettingsUpsert = async ($) => {
  return $.response[204].empty();
};
