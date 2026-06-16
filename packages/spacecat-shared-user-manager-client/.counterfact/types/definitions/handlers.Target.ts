import type { handlers_TargetLanguage } from "./handlers.TargetLanguage.js";
import type { handlers_Location } from "./handlers.Location.js";

export type handlers_Target = {
  benchmarks_count?: number;
  campaign_id?: string;
  created_at?: string;
  database?: string;
  device?: string;
  domain?: string;
  id?: string;
  keywords_count?: number;
  language?: handlers_TargetLanguage;
  location?: handlers_Location;
  name?: string;
  volume_type?: string;
};
