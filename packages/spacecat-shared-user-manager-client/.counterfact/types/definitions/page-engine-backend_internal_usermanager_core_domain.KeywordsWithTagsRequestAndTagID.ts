import type { page_engine_backend_internal_usermanager_core_domain_MetricRangeFilter } from "./page-engine-backend_internal_usermanager_core_domain.MetricRangeFilter.js";

export type page_engine_backend_internal_usermanager_core_domain_KeywordsWithTagsRequestAndTagID =
  {
    draft?: boolean;
    filters?: Array<page_engine_backend_internal_usermanager_core_domain_MetricRangeFilter>;
    limit?: number;
    page?: number;
    search?: string;
    sort?: string;
    sort_dir?: string;
    tag_id?: string;
    unassigned_only?: boolean;
    with_hierarchy?: boolean;
  };
