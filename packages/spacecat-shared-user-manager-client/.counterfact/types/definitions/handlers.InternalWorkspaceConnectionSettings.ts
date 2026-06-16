import type { handlers_InternalAdobeAnalyticsConnectionSettings } from "./handlers.InternalAdobeAnalyticsConnectionSettings.js";
import type { handlers_GoogleAdsConnectionSettings } from "./handlers.GoogleAdsConnectionSettings.js";
import type { handlers_GoogleAnalyticsConnectionSettings } from "./handlers.GoogleAnalyticsConnectionSettings.js";
import type { handlers_GoogleSearchConsoleConnectionSettings } from "./handlers.GoogleSearchConsoleConnectionSettings.js";
import type { handlers_LogFileAnalysisConnectionSettings } from "./handlers.LogFileAnalysisConnectionSettings.js";

/**
 * Connection settings for internal use (adobe analytics returns adobe_proxy_auth_id)
 */
export type handlers_InternalWorkspaceConnectionSettings = {
  adobe_analytics?: handlers_InternalAdobeAnalyticsConnectionSettings;
  google_ads?: handlers_GoogleAdsConnectionSettings;
  google_analytics?: handlers_GoogleAnalyticsConnectionSettings;
  google_console?: handlers_GoogleSearchConsoleConnectionSettings;
  log_file_analysis?: handlers_LogFileAnalysisConnectionSettings;
};
