import type { page_engine_backend_internal_usermanager_core_domain_ProductTierIDs } from "./page-engine-backend_internal_usermanager_core_domain.ProductTierIDs.js";

export type handlers_activationPanelWorkspaceCreateForm = {
  email: string;
  icon?: string;
  /**
   * @default false
   */
  partnership_enabled?: boolean;
  product_tiers?: Array<page_engine_backend_internal_usermanager_core_domain_ProductTierIDs>;
  title: string;
};
