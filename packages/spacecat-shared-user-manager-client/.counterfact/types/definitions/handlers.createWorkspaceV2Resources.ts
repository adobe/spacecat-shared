import type { handlers_aiProductResources } from "./handlers.aiProductResources.js";
import type { page_engine_backend_internal_usermanager_core_domain_WorkspaceResourcesGlobal } from "./page-engine-backend_internal_usermanager_core_domain.WorkspaceResourcesGlobal.js";
import type { page_engine_backend_internal_usermanager_core_domain_WorkspaceProductResources } from "./page-engine-backend_internal_usermanager_core_domain.WorkspaceProductResources.js";
import type { page_engine_backend_internal_usermanager_core_domain_WorkspaceResourcesSEO } from "./page-engine-backend_internal_usermanager_core_domain.WorkspaceResourcesSEO.js";

export type handlers_createWorkspaceV2Resources = {
  ai?: handlers_aiProductResources;
  general?: page_engine_backend_internal_usermanager_core_domain_WorkspaceResourcesGlobal;
  product_resources?: Array<page_engine_backend_internal_usermanager_core_domain_WorkspaceProductResources>;
  seo?: page_engine_backend_internal_usermanager_core_domain_WorkspaceResourcesSEO;
};
