import type { page_engine_backend_internal_usermanager_core_domain_MetricRangeFilter } from "./page-engine-backend_internal_usermanager_core_domain.MetricRangeFilter.js";

export type page_engine_backend_internal_usermanager_core_domain_KeywordsWithTagsRequestAndTagIDs =
  {
    draft?: boolean;
    filters?: Array<page_engine_backend_internal_usermanager_core_domain_MetricRangeFilter>;
    limit?: number;
    page?: number;
    search?: string;
    sort?: string;
    sort_dir?: string;
    tag_ids?: Array<string>;
    unassigned_only?: boolean;
    with_hierarchy?: boolean;
  };
