import type { page_engine_backend_internal_usermanager_core_domain_ProjectOwner } from "./page-engine-backend_internal_usermanager_core_domain.ProjectOwner.js";
import type { page_engine_backend_internal_usermanager_core_domain_ProductID } from "./page-engine-backend_internal_usermanager_core_domain.ProductID.js";
import type { page_engine_backend_internal_usermanager_core_domain_ProjectStatus } from "./page-engine-backend_internal_usermanager_core_domain.ProjectStatus.js";

export type page_engine_backend_internal_usermanager_core_domain_AdminProject =
  {
    created_at?: string;
    domain?: string;
    id?: string;
    is_transferable?: boolean;
    keywords?: number;
    last_updated_at?: string;
    max_pages_per_crawler?: number;
    owner?: page_engine_backend_internal_usermanager_core_domain_ProjectOwner;
    pages?: number;
    pagespeed_urls?: number;
    product_type?: page_engine_backend_internal_usermanager_core_domain_ProductID;
    prompts?: number;
    status?: page_engine_backend_internal_usermanager_core_domain_ProjectStatus;
    title?: string;
  };
