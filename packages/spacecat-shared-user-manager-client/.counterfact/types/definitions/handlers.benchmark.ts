import type { handlers_benchmarkTags } from "./handlers.benchmarkTags.js";

export type handlers_benchmark = {
  color?: string;
  id?: string;
  sync_enabled?: boolean;
  tags?: handlers_benchmarkTags;
  url?: string;
};
