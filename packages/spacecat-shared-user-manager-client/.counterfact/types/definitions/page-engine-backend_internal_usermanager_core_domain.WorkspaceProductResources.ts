import type { page_engine_backend_internal_usermanager_core_domain_ProductID } from "./page-engine-backend_internal_usermanager_core_domain.ProductID.js";

export type page_engine_backend_internal_usermanager_core_domain_WorkspaceProductResources =
  {
    /**
     * @example "si"
     */
    product_id?: page_engine_backend_internal_usermanager_core_domain_ProductID;
    resources?: { [key: string]: number };
  };
