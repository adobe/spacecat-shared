import type { handlers_productTiersGroup } from "./handlers.productTiersGroup.js";
import type { page_engine_backend_internal_usermanager_core_domain_Tier } from "./page-engine-backend_internal_usermanager_core_domain.Tier.js";

export type handlers_tiersResponse = {
  products?: Array<handlers_productTiersGroup>;
  tiers?: Array<page_engine_backend_internal_usermanager_core_domain_Tier>;
};
