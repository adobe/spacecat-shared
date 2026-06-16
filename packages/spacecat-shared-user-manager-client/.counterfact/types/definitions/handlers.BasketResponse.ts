import type { rbac_RoleName } from "./rbac.RoleName.js";

export type handlers_BasketResponse = {
  /**
   * BasketID is the id of the keywords-list
   */
  basket_id?: number;
  /**
   * BasketType is the type of the keywords-list
   */
  basket_type?: string;
  /**
   * KeywordsCount is the count of keywords in the keywords-list
   */
  keywords_count?: number;
  /**
   * Name is the name of the keywords-list
   */
  name?: string;
  /**
   * OwnerID is the id of the owner of the keywords-list
   */
  owner_id?: number;
  /**
   * Role is the role of the user in the keywords-list. Namely, role/keywords_list/editor, role/keywords_list/viewer
   */
  role?: rbac_RoleName;
  /**
   * SharedWith is the count of users with whom the keywords-list is shared
   */
  shared_with?: number;
  /**
   * UpdatedAt is the last update time of the keywords-list
   */
  updated_at?: string;
  /**
   * UserID is the id of the user of the keywords-list
   */
  user_id?: number;
};
