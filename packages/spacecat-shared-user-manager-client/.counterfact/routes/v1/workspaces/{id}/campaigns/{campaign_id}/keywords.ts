import type { workspacesCampaignKeywordsList } from "../../../../../../types/paths/v1/workspaces/{id}/campaigns/{campaign_id}/keywords.types.js";

export const GET: workspacesCampaignKeywordsList = async ($) => {
  return $.response[200].random();
};
