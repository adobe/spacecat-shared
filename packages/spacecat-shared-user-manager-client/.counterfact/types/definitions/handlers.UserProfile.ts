import type { handlers_Country } from "./handlers.Country.js";
import type { handlers_UserJob } from "./handlers.UserJob.js";
import type { handlers_UserProject } from "./handlers.UserProject.js";
import type { handlers_UserWorkspace } from "./handlers.UserWorkspace.js";

export type handlers_UserProfile = {
  availability?: string;
  categories?: Array<string>;
  company?: string;
  country?: handlers_Country;
  description?: string;
  email?: string;
  es_type?: string;
  id?: number;
  jobs?: Array<handlers_UserJob>;
  languages?: Array<string>;
  linked_in?: string;
  locale?: string;
  name?: string;
  phone?: string;
  profession?: string;
  profile_pic?: string;
  projects?: Array<handlers_UserProject>;
  skills?: Array<string>;
  time_zone?: string;
  workspaces?: Array<handlers_UserWorkspace>;
};
