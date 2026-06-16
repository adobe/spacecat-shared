export type handlers_pagespeedCrawlerVisibleForm = {
  device: string;
  interval?:
    | "once"
    | "daily"
    | "weekly"
    | "week-days"
    | "bi-weekly"
    | "monthly";
  name: string;
};
