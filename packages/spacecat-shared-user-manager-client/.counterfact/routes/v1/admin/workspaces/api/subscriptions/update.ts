import type { activationPanelSubscriptionUpdate } from "../../../../../../types/paths/v1/admin/workspaces/api/subscriptions/update.types.js";

export const PUT: activationPanelSubscriptionUpdate = async ($) => {
  return $.response[204].empty();
};
