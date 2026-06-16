import type { page_engine_backend_internal_usermanager_core_domain_SOXProductActivation } from "./page-engine-backend_internal_usermanager_core_domain.SOXProductActivation.js";

export type page_engine_backend_internal_usermanager_core_domain_SOXWorkspace =
  {
    ownerID?: number;
    products?: Array<page_engine_backend_internal_usermanager_core_domain_SOXProductActivation>;
    status?: string;
    subscription_activation_date?: string;
    subscription_expiration_date?: string;
    subscription_id?: number;
    workspace_name?: string;
    workspace_owner?: string;
  };
