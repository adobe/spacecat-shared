import type { page_engine_backend_internal_usermanager_core_domain_KeywordTags } from "./page-engine-backend_internal_usermanager_core_domain.KeywordTags.js";

export type page_engine_backend_internal_usermanager_core_domain_KeywordWithMetrics =
  {
    id?: string;
    name?: string;
    position?: number;
    search_volume?: number;
    tags?: page_engine_backend_internal_usermanager_core_domain_KeywordTags;
    traffic?: number;
    url?: string;
  };
