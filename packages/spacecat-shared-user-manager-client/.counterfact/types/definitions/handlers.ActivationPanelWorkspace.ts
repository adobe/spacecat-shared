import type { handlers_ActivationPanelOwner } from "./handlers.ActivationPanelOwner.js";
import type { page_engine_backend_internal_usermanager_core_domain_ProductTierWithTimestamps } from "./page-engine-backend_internal_usermanager_core_domain.ProductTierWithTimestamps.js";

export type handlers_ActivationPanelWorkspace = {
  corporate_account_id?: number;
  created_at?: string;
  expiration_date?: string;
  icon?: string;
  id?: string;
  last_updated_at?: string;
  owner?: handlers_ActivationPanelOwner;
  parent_id?: string;
  partnership_enabled?: boolean;
  product_tiers?: Array<page_engine_backend_internal_usermanager_core_domain_ProductTierWithTimestamps>;
  status?: string;
  subscription_id?: number;
  subscription_rank?: number;
  title?: string;
};
