import type { keywordsListDeleteMembers } from "../../../../../../types/paths/v1/workspaces/{id}/keywordslists/{basket_id}/members.types.js";
import type { keywordsListMembers } from "../../../../../../types/paths/v1/workspaces/{id}/keywordslists/{basket_id}/members.types.js";
import type { keywordsListUpdateMembersRole } from "../../../../../../types/paths/v1/workspaces/{id}/keywordslists/{basket_id}/members.types.js";
import type { keywordsListAddMembers } from "../../../../../../types/paths/v1/workspaces/{id}/keywordslists/{basket_id}/members.types.js";

export const DELETE: keywordsListDeleteMembers = async ($) => {
  return $.response[204].empty();
};

export const GET: keywordsListMembers = async ($) => {
  return $.response[200].random();
};

export const PATCH: keywordsListUpdateMembersRole = async ($) => {
  return $.response[204].empty();
};

export const POST: keywordsListAddMembers = async ($) => {
  return $.response[201].empty();
};
