import type { handlers_BasketResponse } from "./handlers.BasketResponse.js";

export type handlers_KeywordsListResponse = {
  baskets?: Array<handlers_BasketResponse>;
  page?: number;
  total?: number;
};
