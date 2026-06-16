import type { handlers_Country } from "./handlers.Country.js";
import type { handlers_UserJob } from "./handlers.UserJob.js";

export type handlers_InternalProfileUpdate = {
  availability?: string;
  company?: string;
  country?: handlers_Country;
  description?: string;
  es_type?: string;
  jobs?: Array<handlers_UserJob>;
  languages?: Array<string>;
  linked_in?: string;
  name?: string;
  phone?: string;
  profession?: string;
  profile_pic?: string;
  skills?: Array<string>;
  time_zone?: string;
};
