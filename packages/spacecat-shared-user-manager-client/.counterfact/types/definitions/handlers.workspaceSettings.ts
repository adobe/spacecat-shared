import type { handlers_ai } from "./handlers.ai.js";
import type { handlers_ci } from "./handlers.ci.js";
import type { handlers_seo } from "./handlers.seo.js";
import type { handlers_si } from "./handlers.si.js";

export type handlers_workspaceSettings = {
  ai?: handlers_ai;
  ci?: handlers_ci;
  seo?: handlers_seo;
  si?: handlers_si;
};
