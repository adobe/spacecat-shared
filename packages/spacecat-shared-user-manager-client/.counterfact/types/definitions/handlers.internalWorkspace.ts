import type { page_engine_backend_internal_usermanager_core_domain_WorkspaceParent } from "./page-engine-backend_internal_usermanager_core_domain.WorkspaceParent.js";
import type { page_engine_backend_internal_usermanager_core_domain_ProductTier } from "./page-engine-backend_internal_usermanager_core_domain.ProductTier.js";
import type { page_engine_backend_internal_usermanager_core_domain_ProductID } from "./page-engine-backend_internal_usermanager_core_domain.ProductID.js";
import type { page_engine_backend_internal_usermanager_core_domain_Tier } from "./page-engine-backend_internal_usermanager_core_domain.Tier.js";

export type handlers_internalWorkspace = {
  created_at?: string;
  icon?: string;
  id?: string;
  is_master?: boolean;
  last_updated_at?: string;
  parent?: page_engine_backend_internal_usermanager_core_domain_WorkspaceParent;
  parent_id?: string;
  partnership_enabled?: boolean;
  product_tiers?: Array<page_engine_backend_internal_usermanager_core_domain_ProductTier>;
  products?: Array<page_engine_backend_internal_usermanager_core_domain_ProductID>;
  status?: string;
  subscription_tier?: page_engine_backend_internal_usermanager_core_domain_Tier;
  title?: string;
};
