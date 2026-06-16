import type { handlers_benchmark } from "./handlers.benchmark.js";

export type handlers_benchmarksListResponse = {
  items?: Array<handlers_benchmark>;
  page?: number;
  total?: number;
};
