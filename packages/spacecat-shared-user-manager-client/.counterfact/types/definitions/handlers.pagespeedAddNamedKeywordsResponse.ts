import type { handlers_keyword } from "./handlers.keyword.js";

export type handlers_pagespeedAddNamedKeywordsResponse = {
  keywords?: Array<handlers_keyword>;
  not_found?: Array<string>;
};
