import type { page_engine_backend_internal_usermanager_core_domain_ProductTierIDs } from "./page-engine-backend_internal_usermanager_core_domain.ProductTierIDs.js";

export type page_engine_backend_internal_usermanager_core_domain_WorkspaceUpsert =
  {
    icon?: string;
    /**
     * @default false
     */
    partnership_enabled?: boolean;
    product_tiers?: Array<page_engine_backend_internal_usermanager_core_domain_ProductTierIDs>;
    title: string;
  };
