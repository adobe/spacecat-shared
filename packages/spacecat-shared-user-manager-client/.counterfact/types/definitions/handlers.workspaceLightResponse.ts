import type { page_engine_backend_internal_usermanager_core_domain_WorkspaceParent } from "./page-engine-backend_internal_usermanager_core_domain.WorkspaceParent.js";
import type { page_engine_backend_internal_usermanager_core_domain_ProductTier } from "./page-engine-backend_internal_usermanager_core_domain.ProductTier.js";

export type handlers_workspaceLightResponse = {
  icon?: string;
  id?: string;
  is_admin?: boolean;
  is_master?: boolean;
  parent?: page_engine_backend_internal_usermanager_core_domain_WorkspaceParent;
  parent_id?: string;
  partnership_enabled?: boolean;
  product_tiers?: Array<page_engine_backend_internal_usermanager_core_domain_ProductTier>;
  products?: Array<string>;
  role?: string;
  shared_with?: number;
  status?: string;
  title?: string;
  users?: number;
};
