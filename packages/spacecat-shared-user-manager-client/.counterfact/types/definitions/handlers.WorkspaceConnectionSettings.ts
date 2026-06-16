import type { handlers_AdobeAnalyticsConnectionSettings } from "./handlers.AdobeAnalyticsConnectionSettings.js";
import type { handlers_GoogleAdsConnectionSettings } from "./handlers.GoogleAdsConnectionSettings.js";
import type { handlers_GoogleAnalyticsConnectionSettings } from "./handlers.GoogleAnalyticsConnectionSettings.js";
import type { handlers_GoogleSearchConsoleConnectionSettings } from "./handlers.GoogleSearchConsoleConnectionSettings.js";
import type { handlers_LogFileAnalysisConnectionSettings } from "./handlers.LogFileAnalysisConnectionSettings.js";

export type handlers_WorkspaceConnectionSettings = {
  adobe_analytics?: handlers_AdobeAnalyticsConnectionSettings;
  google_ads?: handlers_GoogleAdsConnectionSettings;
  google_analytics?: handlers_GoogleAnalyticsConnectionSettings;
  google_console?: handlers_GoogleSearchConsoleConnectionSettings;
  log_file_analysis?: handlers_LogFileAnalysisConnectionSettings;
};
