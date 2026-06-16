/**
 * V2 request body for validating Adobe Analytics metrics and dimensions
 */
export type handlers_AdobeAnalyticsValidateV2Request = {
  credential_id: number;
  dimension?: string;
  global_company_id: string;
  metric: string;
  rsid: string;
};
