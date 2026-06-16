import type { handlers_AdobeOrganizationInfo } from "./handlers.AdobeOrganizationInfo.js";

export type handlers_AdobeCredentialStatusInfo = {
  adobe_proxy_auth_id?: string;
  organizations?: Array<handlers_AdobeOrganizationInfo>;
  status?: string;
};
