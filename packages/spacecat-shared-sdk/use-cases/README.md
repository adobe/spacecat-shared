# SpaceCat SDK

## Use Case: Configure Audits and Reports
Enabling or disabling audits and configure reporting (i.e. alerts) for a list of sites within a single specified 
organization.
If the sites are already created, assumption is that they have the correct organizationId set.
If configuration already exists (slack channel, mentions, byOrg, disabled for that audit type), the script will 
overwrite the existing values.

### Configuration
See `config-audits-reports.json` for an example configuration file.
Fill in the `config-audits-reports.json` file with the following information:
- mandatory: `imsOrgId` and `orgName`, if the organization is new, or `orgId` if the organization already exists in 
  SpaceCat. The script doesn't work without an organization.
- mandatory: `siteBaseUrls` with one or more **base URLs** (without `www`, with `https://`, without trailing `/`) of 
  the sites to configure.

### Usage
```bash
node configure-audits-reports.js config-audits-reports.json
```
