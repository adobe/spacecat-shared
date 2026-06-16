import type { handlers_Condition } from "./handlers.Condition.js";
import type { page_engine_backend_internal_usermanager_core_domain_Filter } from "./page-engine-backend_internal_usermanager_core_domain.Filter.js";

export type handlers_SegmentInternalResponse = {
  conditions?: Array<handlers_Condition>;
  created_at?: string;
  filters?: page_engine_backend_internal_usermanager_core_domain_Filter;
  id?: string;
  name?: string;
  updated_at?: string;
};
