import type { page_engine_backend_internal_usermanager_core_domain_SegmentColumn } from "./page-engine-backend_internal_usermanager_core_domain.SegmentColumn.js";
import type { page_engine_backend_internal_usermanager_core_domain_Filter } from "./page-engine-backend_internal_usermanager_core_domain.Filter.js";
import type { page_engine_backend_internal_usermanager_core_domain_FilterOperator } from "./page-engine-backend_internal_usermanager_core_domain.FilterOperator.js";

export type page_engine_backend_internal_usermanager_core_domain_Filter = {
  col?: page_engine_backend_internal_usermanager_core_domain_SegmentColumn;
  filters?: Array<page_engine_backend_internal_usermanager_core_domain_Filter>;
  op?: page_engine_backend_internal_usermanager_core_domain_FilterOperator;
  value?: unknown;
};
