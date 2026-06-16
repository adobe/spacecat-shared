import type { page_engine_backend_internal_usermanager_core_domain_MembershipStatus } from "./page-engine-backend_internal_usermanager_core_domain.MembershipStatus.js";
import type { handlers_WorkspaceMemberProject } from "./handlers.WorkspaceMemberProject.js";

export type handlers_WorkspaceMember = {
  email?: string;
  id?: number;
  is_all_projects_access?: boolean;
  is_home_workspace?: boolean;
  membership_status?: page_engine_backend_internal_usermanager_core_domain_MembershipStatus;
  profile_pic?: string;
  projects?: Array<handlers_WorkspaceMemberProject>;
  role?: string;
};
