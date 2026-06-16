import type { handlers_TargetLanguage } from "./handlers.TargetLanguage.js";
import type { handlers_Location } from "./handlers.Location.js";

export type handlers_TargetMetadata = {
  database?: string;
  device?: string;
  id?: string;
  language?: handlers_TargetLanguage;
  location?: handlers_Location;
  name?: string;
};
