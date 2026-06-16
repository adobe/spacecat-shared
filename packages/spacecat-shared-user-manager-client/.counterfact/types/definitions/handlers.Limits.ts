import type { handlers_UsedLimit } from "./handlers.UsedLimit.js";
import type { handlers_UsedLimitWithDrafted } from "./handlers.UsedLimitWithDrafted.js";

export type handlers_Limits = {
  api_units?: handlers_UsedLimit;
  keywords?: handlers_UsedLimitWithDrafted;
  pagespeed_urls?: handlers_UsedLimitWithDrafted;
  projects?: handlers_UsedLimitWithDrafted;
  service_units?: handlers_UsedLimit;
  users?: handlers_UsedLimitWithDrafted;
};
