import type { page_engine_backend_internal_usermanager_core_domain_ProductID } from "./page-engine-backend_internal_usermanager_core_domain.ProductID.js";

export type handlers_projectAddMembersForm = {
  members: Array<string>;
  /**
   * for backward compatibility no validate is required and assign SEO in case its empty
   */
  product_id?: page_engine_backend_internal_usermanager_core_domain_ProductID;
  role: string;
};
