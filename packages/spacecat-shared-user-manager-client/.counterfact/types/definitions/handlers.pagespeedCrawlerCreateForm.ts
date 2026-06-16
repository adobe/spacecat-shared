import type { handlers_pagespeedKeywordsForm } from "./handlers.pagespeedKeywordsForm.js";

export type handlers_pagespeedCrawlerCreateForm = {
  crawler_type?: "keywords" | "urls";
  device: string;
  interval?:
    | "once"
    | "daily"
    | "weekly"
    | "week-days"
    | "bi-weekly"
    | "monthly";
  invisible?: boolean;
  keyword_names?: Array<string>;
  keywords?: Array<handlers_pagespeedKeywordsForm>;
  name: string;
  target_id?: string;
  urls?: Array<string>;
};
