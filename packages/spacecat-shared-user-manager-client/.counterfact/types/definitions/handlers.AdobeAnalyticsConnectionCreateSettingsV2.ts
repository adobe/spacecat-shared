/**
 * Adobe Analytics connection settings (v2) with credential_id instead of adobe_proxy_auth_id
 */
export type handlers_AdobeAnalyticsConnectionCreateSettingsV2 = {
  credential_id: number;
  dimension_date_range_day_name?: string;
  dimension_entry_page_url_name: string;
  dimension_marketing_channel_detail_name: string;
  dimension_marketing_channel_name: string;
  global_company_id: string;
  metric_bounce_rate_name: string;
  metric_target_conversion_name: string;
  metric_visits_name: string;
  rs_name: string;
  rsid: string;
};
