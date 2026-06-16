/**
 * Request body for validating Adobe Analytics metrics and dimensions
 */
export type handlers_AdobeAnalyticsValidateRequest = {
  dimension?: string;
  metric: string;
  rsid: string;
};
