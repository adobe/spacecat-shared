import type { handlers_AdobeAnalyticsConnectionCreateSettingsV2 } from "./handlers.AdobeAnalyticsConnectionCreateSettingsV2.js";

/**
 * V2 request body for creating Adobe Analytics workspace connection (uses credential_id)
 */
export type handlers_AdobeAnalyticsWorkspaceConnectionCreateV2 = {
  project_ids?: Array<string>;
  settings?: handlers_AdobeAnalyticsConnectionCreateSettingsV2;
};
