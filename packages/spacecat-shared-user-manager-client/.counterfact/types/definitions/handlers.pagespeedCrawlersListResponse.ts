import type { handlers_pagespeedCrawler } from "./handlers.pagespeedCrawler.js";

export type handlers_pagespeedCrawlersListResponse = {
  items?: Array<handlers_pagespeedCrawler>;
  page?: number;
  total?: number;
};
