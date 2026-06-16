import type { handlers_AdobeAnalyticsConnectionUpdateSettingsV2 } from "./handlers.AdobeAnalyticsConnectionUpdateSettingsV2.js";

/**
 * V2 request body for updating Adobe Analytics workspace connection (uses credential_id)
 */
export type handlers_AdobeAnalyticsWorkspaceConnectionUpdateV2 = {
  project_ids?: Array<string>;
  settings?: handlers_AdobeAnalyticsConnectionUpdateSettingsV2;
};
