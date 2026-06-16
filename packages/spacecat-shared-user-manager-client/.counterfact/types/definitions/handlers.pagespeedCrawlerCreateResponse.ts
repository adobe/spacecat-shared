import type { handlers_keyword } from "./handlers.keyword.js";
import type { handlers_pagespeedURL } from "./handlers.pagespeedURL.js";

export type handlers_pagespeedCrawlerCreateResponse = {
  crawler_type?: string;
  device?: string;
  id?: string;
  interval?: string;
  keywords?: Array<handlers_keyword>;
  name?: string;
  not_found_keywords?: Array<string>;
  status?: string;
  total_keywords?: number;
  total_urls?: number;
  urls?: Array<handlers_pagespeedURL>;
};
