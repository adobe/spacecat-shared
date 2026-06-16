import type { page_engine_backend_internal_usermanager_core_domain_KeywordWithMetrics } from "./page-engine-backend_internal_usermanager_core_domain.KeywordWithMetrics.js";

export type page_engine_backend_internal_usermanager_core_domain_KeywordsWithMetricsResponse =
  {
    all_total?: number;
    items?: Array<page_engine_backend_internal_usermanager_core_domain_KeywordWithMetrics>;
    page?: number;
    total?: number;
    unassigned?: number;
  };
