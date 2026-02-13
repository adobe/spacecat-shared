-- Seed data for Tenant Alpha
-- Organization ID: 04f63783-3f76-4076-bbda-71a11145303c
-- Generated: 2026-02-02T18:10:09.735272

-- Organization
INSERT INTO organizations (id, name, ims_org_id, config, fulfillable_items, created_at, updated_at, updated_by) VALUES (
    '04f63783-3f76-4076-bbda-71a11145303c',
    'Tenant Alpha Experience Cloud',
    'F489CFB4556ECF927F000101@AdobeOrg',
    '{"handlers": {}, "slack": {"channel": "C04D51RSGLT", "workspace": "WORKSPACE_EXTERNAL"}}'::jsonb,
    '{"aem_sites_optimizer": {"items": ["dx_aem_perf_content_requests", "dx_aem_perf_auto_fix", "dx_aem_perf_support", "dx_aem_perf_auto_suggest", "wf_instance", "dma_acp_cs", "esm_user_storage", "esm_shared_storage", "asset_sharing_policy_config", "user_group_assignment", "core_services_cc", "domain_claiming", "user_sync", "overdelegation_allowed", "support_case_creation_allowed"]}}'::jsonb,
    '2024-12-20T07:31:25.919Z'::timestamptz,
    '2025-07-09T22:23:52.300Z'::timestamptz,
    'system'
);

-- Entitlements
INSERT INTO entitlements (id, organization_id, product_code, tier, quotas, created_at, updated_at, updated_by) VALUES (
    '0914fe7c-6e23-427b-9db2-106c234d5dfd',
    '04f63783-3f76-4076-bbda-71a11145303c',
    'ASO'::entitlement_product_code,
    'PAID'::entitlement_tier,
    '{"llmo_trial_prompts": 200, "llmo_trial_prompts_consumed": 0}'::jsonb,
    '2025-10-15T14:41:52.193Z'::timestamptz,
    '2025-10-15T14:41:52.193Z'::timestamptz,
    'system'
);
INSERT INTO entitlements (id, organization_id, product_code, tier, quotas, created_at, updated_at, updated_by) VALUES (
    '9b8cf1c5-1f1b-422e-a159-9847fd1fe808',
    '04f63783-3f76-4076-bbda-71a11145303c',
    'LLMO'::entitlement_product_code,
    'FREE_TRIAL'::entitlement_tier,
    '{"llmo_trial_prompts": 200, "llmo_trial_prompts_consumed": 0}'::jsonb,
    '2025-10-08T12:44:45.391Z'::timestamptz,
    '2025-10-08T12:44:45.392Z'::timestamptz,
    'system'
);

-- Projects
INSERT INTO projects (id, organization_id, project_name, created_at, updated_at, updated_by) VALUES (
    '6fc3365d-f400-4a17-91e9-7141e5b82350',
    '04f63783-3f76-4076-bbda-71a11145303c',
    'tenant-alphaland.com',
    '2025-11-24T16:36:21.139Z'::timestamptz,
    '2025-11-24T16:36:21.139Z'::timestamptz,
    'system'
);
INSERT INTO projects (id, organization_id, project_name, created_at, updated_at, updated_by) VALUES (
    '6de5d214-15c5-4969-b074-f95e8bc237a1',
    '04f63783-3f76-4076-bbda-71a11145303c',
    'tenant-alpha-secondary.com',
    '2025-11-24T17:07:12.928Z'::timestamptz,
    '2025-11-24T17:07:12.928Z'::timestamptz,
    'system'
);

-- Sites
INSERT INTO sites (id, organization_id, base_url, name, is_primary_locale, language, region, config, code, delivery_type, authoring_type, github_url, delivery_config, hlx_config, is_sandbox, is_live, is_live_toggled_at, external_owner_id, external_site_id, page_types, project_id, created_at, updated_at, updated_by) VALUES (
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '04f63783-3f76-4076-bbda-71a11145303c',
    'https://tenant-alphaland.com',
    'tenant-alphaland.com',
    NULL,
    'en',
    'US',
    '{"handlers": {"cwv": {"groupedURLs": [{"name": "Products", "pattern": "/product"}]}}, "imports": [{"sources": ["ahrefs"], "type": "organic-traffic", "enabled": true, "destinations": ["default"]}, {"sources": ["ahrefs"], "type": "organic-keywords", "enabled": true, "destinations": ["default"]}, {"type": "cwv-daily", "sources": ["rum"], "enabled": true, "destinations": ["default"]}, {"type": "traffic-analysis", "sources": ["rum"], "enabled": true, "destinations": ["default"]}, {"sources": ["rum"], "type": "all-traffic", "enabled": true, "destinations": ["default"]}, {"type": "user-engagement", "sources": ["rum"], "enabled": false, "destinations": ["default"]}, {"type": "cwv-weekly", "sources": ["rum"], "enabled": false, "destinations": ["default"]}, {"geo": "global", "type": "top-pages", "sources": ["ahrefs"], "enabled": true, "destinations": ["default"]}]}'::jsonb,
    '{}'::jsonb,
    'aem_cs'::delivery_type,
    'cs'::authoring_type,
    NULL,
    '{"__reindex": "now", "siteId": "51ea4b7c-1af2-4b6d-8c61-b3adfd065f8d", "environmentId": "440257", "programId": "50513", "authorURL": "https://author-p50513-e440257.adobeaemcloud.com"}'::jsonb,
    '{}'::jsonb,
    false,
    true,
    NULL::timestamptz,
    'p50513',
    'e440257',
    NULL::jsonb,
    '6fc3365d-f400-4a17-91e9-7141e5b82350',
    '2024-12-17T09:54:09.625Z'::timestamptz,
    '2026-01-28T05:12:19.151Z'::timestamptz,
    'system'
);
INSERT INTO sites (id, organization_id, base_url, name, is_primary_locale, language, region, config, code, delivery_type, authoring_type, github_url, delivery_config, hlx_config, is_sandbox, is_live, is_live_toggled_at, external_owner_id, external_site_id, page_types, project_id, created_at, updated_at, updated_by) VALUES (
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '04f63783-3f76-4076-bbda-71a11145303c',
    'https://tenant-alpha-secondary.com',
    NULL,
    NULL,
    'en',
    'US',
    '{"imports": [{"sources": ["ahrefs"], "type": "organic-traffic", "enabled": true, "destinations": ["default"]}, {"sources": ["ahrefs"], "type": "organic-keywords", "enabled": true, "destinations": ["default"]}, {"geo": "global", "type": "top-pages", "sources": ["ahrefs"], "enabled": true, "destinations": ["default"]}, {"sources": ["rum"], "type": "all-traffic", "enabled": true, "destinations": ["default"]}, {"type": "traffic-analysis", "sources": ["rum"], "enabled": true, "destinations": ["default"]}]}'::jsonb,
    '{}'::jsonb,
    'aem_cs'::delivery_type,
    'cs'::authoring_type,
    NULL,
    '{"siteId": "c3e977e3-d30a-47e4-a78f-2f92449a03d1", "environmentId": "440257", "programId": "50513", "authorURL": "https://author-p50513-e440257.adobeaemcloud.com"}'::jsonb,
    '{}'::jsonb,
    false,
    true,
    '2024-12-03T15:58:06.464Z'::timestamptz,
    'p50513',
    'e440257',
    NULL::jsonb,
    '6de5d214-15c5-4969-b074-f95e8bc237a1',
    '2024-11-27T15:46:29.760Z'::timestamptz,
    '2026-02-02T06:59:59.452Z'::timestamptz,
    'system'
);

-- Site Enrollments
INSERT INTO site_enrollments (id, site_id, entitlement_id, created_at, updated_at, updated_by) VALUES (
    'a820d82a-6406-4803-b446-ebf03ed5293b',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '0914fe7c-6e23-427b-9db2-106c234d5dfd',
    '2025-10-15T14:41:54.326Z'::timestamptz,
    '2025-10-15T14:41:54.326Z'::timestamptz,
    'system'
);
INSERT INTO site_enrollments (id, site_id, entitlement_id, created_at, updated_at, updated_by) VALUES (
    'c85c9552-38ad-4df4-b814-a5a644cdb57b',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '0914fe7c-6e23-427b-9db2-106c234d5dfd',
    '2025-10-15T14:41:52.488Z'::timestamptz,
    '2025-10-15T14:41:52.488Z'::timestamptz,
    'system'
);

-- Audits (limited sample)
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '74a041ed-a15c-4bdc-a38c-5203b22d2ab3',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2024-12-29&enddate=2025-01-05',
    true,
    false,
    NULL,
    '2025-01-05T05:05:54.775Z'::timestamptz,
    '2025-01-05T05:05:54.775Z'::timestamptz,
    '2025-01-05T05:05:54.775Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '66912d53-7ac7-4a27-8ba3-906c0b810d2d',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2025-01-05&enddate=2025-01-12',
    true,
    false,
    NULL,
    '2025-01-12T05:11:21.970Z'::timestamptz,
    '2025-01-12T05:11:21.970Z'::timestamptz,
    '2025-01-12T05:11:21.970Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'fd44482c-c361-47b3-ad27-727af2372862',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2025-01-12&enddate=2025-01-19',
    true,
    false,
    NULL,
    '2025-01-19T05:06:45.012Z'::timestamptz,
    '2025-01-19T05:06:45.012Z'::timestamptz,
    '2025-01-19T05:06:45.012Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '5d892e04-ea6a-4e46-9fb9-68dc19d34bcb',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2025-01-19&enddate=2025-01-26',
    true,
    false,
    NULL,
    '2025-01-26T05:06:19.947Z'::timestamptz,
    '2025-01-26T05:06:19.947Z'::timestamptz,
    '2025-01-26T05:06:19.947Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'f24bc09f-b134-4a11-884d-29e65da71ce5',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2025-01-26&enddate=2025-02-02',
    true,
    false,
    NULL,
    '2025-02-02T05:07:49.497Z'::timestamptz,
    '2025-02-02T05:07:49.498Z'::timestamptz,
    '2025-02-02T05:07:49.498Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '12c1c248-2a66-48e7-af98-47ac904bb8e0',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2025-02-02&enddate=2025-02-09',
    true,
    false,
    NULL,
    '2025-02-09T05:06:16.537Z'::timestamptz,
    '2025-02-09T05:06:16.537Z'::timestamptz,
    '2025-02-09T05:06:16.538Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '1eb51889-e7a4-44e9-9cd8-19907fe489f1',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2025-02-09&enddate=2025-02-16',
    true,
    false,
    NULL,
    '2025-02-16T05:05:16.228Z'::timestamptz,
    '2025-02-16T05:05:16.228Z'::timestamptz,
    '2025-02-16T05:05:16.228Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '2da858d8-1a22-4284-b1b8-fda95eb6ae1c',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2025-02-16&enddate=2025-02-23',
    true,
    false,
    NULL,
    '2025-02-23T05:03:56.384Z'::timestamptz,
    '2025-02-23T05:03:56.384Z'::timestamptz,
    '2025-02-23T05:03:56.384Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '7c1529e3-3dde-469f-bb94-aec953c6535d',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2025-02-23&enddate=2025-03-02',
    true,
    false,
    NULL,
    '2025-03-02T05:04:47.913Z'::timestamptz,
    '2025-03-02T05:04:47.913Z'::timestamptz,
    '2025-03-02T05:04:47.913Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'c0e93f11-4b2c-40da-882d-6cafe461e35e',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2025-04-30&enddate=2025-05-07',
    true,
    false,
    NULL,
    '2025-05-07T15:21:25.703Z'::timestamptz,
    '2025-05-07T15:21:25.704Z'::timestamptz,
    '2025-05-07T15:21:25.705Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'ce16afb0-4dfc-4fc2-add2-646053b91646',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2025-05-14&enddate=2025-05-21',
    true,
    false,
    NULL,
    '2025-05-21T12:50:11.186Z'::timestamptz,
    '2025-05-21T12:50:11.187Z'::timestamptz,
    '2025-05-21T12:50:11.189Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '9fce3b9d-9d4c-4b87-a68d-125474a0d733',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2025-05-28&enddate=2025-06-04',
    true,
    false,
    NULL,
    '2025-06-04T13:43:51.851Z'::timestamptz,
    '2025-06-04T13:43:51.852Z'::timestamptz,
    '2025-06-04T13:43:51.852Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '1cb69592-3f4b-46a2-9e58-76be071ae60c',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2025-05-29&enddate=2025-06-05',
    true,
    false,
    NULL,
    '2025-06-05T09:07:29.421Z'::timestamptz,
    '2025-06-05T09:07:29.421Z'::timestamptz,
    '2025-06-05T09:07:29.422Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '0432823c-49f7-41e5-b227-1b13d627e45a',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    '404',
    '[{"sources": [], "url": "https://www.tenant-alphaland.com/Pokemon.", "pageviews": "200"}]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alphaland.com&startdate=2025-06-09&enddate=2025-06-16',
    true,
    false,
    NULL,
    '2025-06-16T10:24:25.803Z'::timestamptz,
    '2025-06-16T10:24:25.804Z'::timestamptz,
    '2025-06-16T10:24:25.805Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '52e102c4-d811-4ed4-b75d-730962615ac0',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'accessibility',
    '{"finalUrl": "www.tenant-alphaland.com", "status": "preparing"}'::jsonb,
    'scrapes/0983c6da-0dee-45cc-b897-3f1fed6b460b/',
    true,
    false,
    NULL,
    '2025-08-06T09:07:25.383Z'::timestamptz,
    '2025-08-06T09:07:25.383Z'::timestamptz,
    '2025-08-06T09:07:25.383Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'd1cb0e9f-ea8b-48ab-a2d4-299b1905f482',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'accessibility',
    '{"finalUrl": "www.tenant-alphaland.com", "status": "preparing"}'::jsonb,
    'scrapes/0983c6da-0dee-45cc-b897-3f1fed6b460b/',
    true,
    false,
    NULL,
    '2025-08-13T07:17:34.873Z'::timestamptz,
    '2025-08-13T07:17:34.873Z'::timestamptz,
    '2025-08-13T07:17:34.874Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '69c3d0c3-e345-4cab-bafd-77cb93c7cef2',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'accessibility',
    '{"finalUrl": "www.tenant-alphaland.com", "status": "preparing"}'::jsonb,
    'scrapes/0983c6da-0dee-45cc-b897-3f1fed6b460b/',
    true,
    false,
    NULL,
    '2025-08-18T06:00:13.372Z'::timestamptz,
    '2025-08-18T06:00:13.372Z'::timestamptz,
    '2025-08-18T06:00:13.373Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '96bde89e-9f0b-4218-a2bb-e82d50f57900',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'accessibility',
    '{"finalUrl": "www.tenant-alphaland.com", "status": "preparing"}'::jsonb,
    'scrapes/0983c6da-0dee-45cc-b897-3f1fed6b460b/',
    true,
    false,
    NULL,
    '2025-08-25T06:00:20.199Z'::timestamptz,
    '2025-08-25T06:00:20.200Z'::timestamptz,
    '2025-08-25T06:00:20.200Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '0dca7bb4-6af2-4bf1-978b-a46c7268ae4d',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'accessibility',
    '{"finalUrl": "www.tenant-alphaland.com", "status": "preparing"}'::jsonb,
    'scrapes/0983c6da-0dee-45cc-b897-3f1fed6b460b/',
    true,
    false,
    NULL,
    '2025-09-01T06:00:25.800Z'::timestamptz,
    '2025-09-01T06:00:25.801Z'::timestamptz,
    '2025-09-01T06:00:25.803Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '7756bbeb-9127-43e1-b7a9-3b0eeda414df',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'accessibility',
    '{"finalUrl": "www.tenant-alphaland.com", "status": "preparing"}'::jsonb,
    'scrapes/0983c6da-0dee-45cc-b897-3f1fed6b460b/',
    true,
    false,
    NULL,
    '2025-09-08T06:00:12.116Z'::timestamptz,
    '2025-09-08T06:00:12.116Z'::timestamptz,
    '2025-09-08T06:00:12.117Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '5d1eeb9e-60be-41e3-8ddf-3e5d9afd2bbf',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alpha-secondary.com&startdate=2024-12-29&enddate=2025-01-05',
    true,
    false,
    NULL,
    '2025-01-05T05:07:08.029Z'::timestamptz,
    '2025-01-05T05:07:08.030Z'::timestamptz,
    '2025-01-05T05:07:08.030Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '6a7850b9-bf40-423c-b5c6-68c772c33c71',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alpha-secondary.com&startdate=2025-01-05&enddate=2025-01-12',
    true,
    false,
    NULL,
    '2025-01-12T05:14:10.521Z'::timestamptz,
    '2025-01-12T05:14:10.521Z'::timestamptz,
    '2025-01-12T05:14:10.521Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'b971187f-e93d-44c0-a879-bc363b613a8e',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alpha-secondary.com&startdate=2025-01-12&enddate=2025-01-19',
    true,
    false,
    NULL,
    '2025-01-19T05:07:39.648Z'::timestamptz,
    '2025-01-19T05:07:39.648Z'::timestamptz,
    '2025-01-19T05:07:39.648Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'c3109ff2-2068-4989-984f-1ebdae569c3a',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alpha-secondary.com&startdate=2025-01-19&enddate=2025-01-26',
    true,
    false,
    NULL,
    '2025-01-26T05:06:46.736Z'::timestamptz,
    '2025-01-26T05:06:46.736Z'::timestamptz,
    '2025-01-26T05:06:46.736Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '28ecb62c-a03b-40ae-b458-d21419dd5536',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alpha-secondary.com&startdate=2025-01-26&enddate=2025-02-02',
    true,
    false,
    NULL,
    '2025-02-02T05:07:59.066Z'::timestamptz,
    '2025-02-02T05:07:59.066Z'::timestamptz,
    '2025-02-02T05:07:59.066Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'ec8f07da-c38d-42c3-85f3-f5c473cc0b47',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alpha-secondary.com&startdate=2025-02-02&enddate=2025-02-09',
    true,
    false,
    NULL,
    '2025-02-09T05:06:15.938Z'::timestamptz,
    '2025-02-09T05:06:15.938Z'::timestamptz,
    '2025-02-09T05:06:15.939Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '41f027a9-5556-448e-8700-baeeccca71f5',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alpha-secondary.com&startdate=2025-02-09&enddate=2025-02-16',
    true,
    false,
    NULL,
    '2025-02-16T05:06:02.538Z'::timestamptz,
    '2025-02-16T05:06:02.538Z'::timestamptz,
    '2025-02-16T05:06:02.538Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'be51fdcf-ba28-4485-9d60-185452cd951b',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alpha-secondary.com&startdate=2025-02-16&enddate=2025-02-23',
    true,
    false,
    NULL,
    '2025-02-23T05:04:44.621Z'::timestamptz,
    '2025-02-23T05:04:44.621Z'::timestamptz,
    '2025-02-23T05:04:44.621Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'f449d95c-b59e-4b21-b6d7-d26d3a34cdaf',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alpha-secondary.com&startdate=2025-02-23&enddate=2025-03-02',
    true,
    false,
    NULL,
    '2025-03-02T05:02:02.453Z'::timestamptz,
    '2025-03-02T05:02:02.453Z'::timestamptz,
    '2025-03-02T05:02:02.453Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '6c9aa772-c7ce-455e-9a50-892543d99ccc',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alpha-secondary.com&startdate=2025-04-30&enddate=2025-05-07',
    true,
    false,
    NULL,
    '2025-05-07T15:21:29.207Z'::timestamptz,
    '2025-05-07T15:21:29.207Z'::timestamptz,
    '2025-05-07T15:21:29.207Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'b20d5a57-4936-4666-988b-6f4b652f710c',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '404',
    '[]'::jsonb,
    'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-404?interval=-1&offset=0&limit=101&url=www.tenant-alpha-secondary.com&startdate=2025-05-28&enddate=2025-06-04',
    true,
    false,
    NULL,
    '2025-06-04T13:44:09.371Z'::timestamptz,
    '2025-06-04T13:44:09.371Z'::timestamptz,
    '2025-06-04T13:44:09.371Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'bed1f8a8-7ca5-4438-8b6a-5bf410628018',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'accessibility',
    '{"finalUrl": "www.tenant-alpha-secondary.com", "status": "preparing"}'::jsonb,
    'scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/',
    true,
    false,
    NULL,
    '2025-08-07T12:49:45.547Z'::timestamptz,
    '2025-08-07T12:49:45.548Z'::timestamptz,
    '2025-08-07T12:49:45.550Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '97778cfc-c014-4393-a5a4-b8cdceb4bb80',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'accessibility',
    '{"finalUrl": "www.tenant-alpha-secondary.com", "status": "preparing"}'::jsonb,
    'scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/',
    true,
    false,
    NULL,
    '2025-09-29T07:14:29.354Z'::timestamptz,
    '2025-09-29T07:14:29.354Z'::timestamptz,
    '2025-09-29T07:14:29.354Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '1758c317-94a0-45d5-87f8-28baeba4973e',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'accessibility',
    '{"finalUrl": "www.tenant-alpha-secondary.com", "status": "preparing"}'::jsonb,
    'scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/',
    true,
    false,
    NULL,
    '2025-10-06T07:16:30.821Z'::timestamptz,
    '2025-10-06T07:16:30.821Z'::timestamptz,
    '2025-10-06T07:16:30.821Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'a5590c4f-d897-42e5-ab54-fc7604ab8afb',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'accessibility',
    '{"finalUrl": "www.tenant-alpha-secondary.com", "status": "preparing"}'::jsonb,
    'scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/',
    true,
    false,
    NULL,
    '2025-10-13T07:11:49.673Z'::timestamptz,
    '2025-10-13T07:11:49.673Z'::timestamptz,
    '2025-10-13T07:11:49.673Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'ad7a6aa0-09e0-458b-ab7e-b55f4d4b15a5',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'alt-text',
    '{"sourceS3Folder": "spacecat-scraper/scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/", "fullAuditRef": "scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/", "detectedTags": {"imagesWithoutAltText": [{"src": "/content/dam/tenant-alpha-chocolate-world/images/blog/our-sweet-history/storytelling-video-historicaltour.jpg", "pageUrl": "/blog/history.html"}, {"src": "/plan-your-visit/amenities-and-accessibility/_jcr_content/root/container/section_1887685911/col1/section/col2/image.coreimg.png/1645138368408/amenities-badge-cac.png", "pageUrl": "/plan-your-visit/amenities-and-accessibility.html"}, {"src": "/plan-your-visit/groups-and-parties/_jcr_content/root/container/section_410668149_co_292676950/col2/call_out_tile/image.img.jpg/1694802555244.jpg?im=Resize=(193)", "pageUrl": "/plan-your-visit/groups-and-parties.html"}, {"src": "/things-to-do/reeses-stuff-your-cup-ingredients/_jcr_content/root/container/section_article_over/col1/section_copy/col2/image.coreimg.png/1677778544157/reeses-syc-logo.png", "pageUrl": "/things-to-do/reeses-stuff-your-cup-ingredients.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}]}, "finalUrl": "https://tenant-alpha-secondary.com"}'::jsonb,
    'https://tenant-alpha-secondary.com',
    true,
    false,
    NULL,
    '2025-02-26T12:09:01.180Z'::timestamptz,
    '2025-02-26T12:09:01.181Z'::timestamptz,
    '2025-02-26T12:09:01.183Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    'faefae51-884b-4940-a53f-efe554a18616',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'alt-text',
    '{"sourceS3Folder": "spacecat-scraper/scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/", "fullAuditRef": "scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/", "detectedTags": {"imagesWithoutAltText": [{"src": "/content/dam/tenant-alpha-chocolate-world/images/blog/our-sweet-history/storytelling-video-historicaltour.jpg", "pageUrl": "/blog/history.html"}, {"src": "/plan-your-visit/amenities-and-accessibility/_jcr_content/root/container/section_1887685911/col1/section/col2/image.coreimg.png/1645138368408/amenities-badge-cac.png", "pageUrl": "/plan-your-visit/amenities-and-accessibility.html"}, {"src": "/plan-your-visit/groups-and-parties/_jcr_content/root/container/section_410668149_co_292676950/col2/call_out_tile/image.img.jpg/1694802555244.jpg?im=Resize=(193)", "pageUrl": "/plan-your-visit/groups-and-parties.html"}, {"src": "/things-to-do/reeses-stuff-your-cup-ingredients/_jcr_content/root/container/section_article_over/col1/section_copy/col2/image.coreimg.png/1677778544157/reeses-syc-logo.png", "pageUrl": "/things-to-do/reeses-stuff-your-cup-ingredients.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}]}, "finalUrl": "https://tenant-alpha-secondary.com"}'::jsonb,
    'https://tenant-alpha-secondary.com',
    true,
    false,
    NULL,
    '2025-02-26T12:24:33.423Z'::timestamptz,
    '2025-02-26T12:24:33.424Z'::timestamptz,
    '2025-02-26T12:24:33.427Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '3af2e62a-38e9-49c8-9105-beb5e03f11ae',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'alt-text',
    '{"sourceS3Folder": "spacecat-scraper/scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/", "fullAuditRef": "scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/", "detectedTags": {"imagesWithoutAltText": [{"src": "/content/dam/tenant-alpha-chocolate-world/images/blog/our-sweet-history/storytelling-video-historicaltour.jpg", "pageUrl": "/blog/history.html"}, {"src": "/plan-your-visit/amenities-and-accessibility/_jcr_content/root/container/section_1887685911/col1/section/col2/image.coreimg.png/1645138368408/amenities-badge-cac.png", "pageUrl": "/plan-your-visit/amenities-and-accessibility.html"}, {"src": "/plan-your-visit/groups-and-parties/_jcr_content/root/container/section_410668149_co_292676950/col2/call_out_tile/image.img.jpg/1694802555244.jpg?im=Resize=(193)", "pageUrl": "/plan-your-visit/groups-and-parties.html"}, {"src": "/things-to-do/reeses-stuff-your-cup-ingredients/_jcr_content/root/container/section_article_over/col1/section_copy/col2/image.coreimg.png/1677778544157/reeses-syc-logo.png", "pageUrl": "/things-to-do/reeses-stuff-your-cup-ingredients.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}]}, "finalUrl": "https://tenant-alpha-secondary.com"}'::jsonb,
    'https://tenant-alpha-secondary.com',
    true,
    false,
    NULL,
    '2025-02-26T12:33:33.631Z'::timestamptz,
    '2025-02-26T12:33:33.632Z'::timestamptz,
    '2025-02-26T12:33:33.635Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '48cdf221-25ae-41b1-805e-4bf326734995',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'alt-text',
    '{"sourceS3Folder": "spacecat-scraper/scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/", "fullAuditRef": "scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/", "detectedTags": {"imagesWithoutAltText": [{"src": "/content/dam/tenant-alpha-chocolate-world/images/blog/our-sweet-history/storytelling-video-historicaltour.jpg", "pageUrl": "/blog/history.html"}, {"src": "/plan-your-visit/amenities-and-accessibility/_jcr_content/root/container/section_1887685911/col1/section/col2/image.coreimg.png/1645138368408/amenities-badge-cac.png", "pageUrl": "/plan-your-visit/amenities-and-accessibility.html"}, {"src": "/plan-your-visit/groups-and-parties/_jcr_content/root/container/section_410668149_co_292676950/col2/call_out_tile/image.img.jpg/1694802555244.jpg?im=Resize=(193)", "pageUrl": "/plan-your-visit/groups-and-parties.html"}, {"src": "/things-to-do/reeses-stuff-your-cup-ingredients/_jcr_content/root/container/section_article_over/col1/section_copy/col2/image.coreimg.png/1677778544157/reeses-syc-logo.png", "pageUrl": "/things-to-do/reeses-stuff-your-cup-ingredients.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}]}, "finalUrl": "https://tenant-alpha-secondary.com"}'::jsonb,
    'https://tenant-alpha-secondary.com',
    true,
    false,
    NULL,
    '2025-02-26T14:47:00.335Z'::timestamptz,
    '2025-02-26T14:47:00.336Z'::timestamptz,
    '2025-02-26T14:47:00.339Z'::timestamptz,
    'system'
);
INSERT INTO audits (id, site_id, audit_type, audit_result, full_audit_ref, is_live, is_error, invocation_id, audited_at, created_at, updated_at, updated_by) VALUES (
    '1e69d5b7-db32-43b9-8fb4-c5634041792a',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'alt-text',
    '{"sourceS3Folder": "spacecat-scraper/scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/", "fullAuditRef": "scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/", "detectedTags": {"imagesWithoutAltText": [{"src": "/content/dam/tenant-alpha-chocolate-world/images/blog/our-sweet-history/storytelling-video-historicaltour.jpg", "pageUrl": "/blog/history.html"}, {"src": "/plan-your-visit/amenities-and-accessibility/_jcr_content/root/container/section_1887685911/col1/section/col2/image.coreimg.png/1645138368408/amenities-badge-cac.png", "pageUrl": "/plan-your-visit/amenities-and-accessibility.html"}, {"src": "/plan-your-visit/groups-and-parties/_jcr_content/root/container/section_410668149_co_292676950/col2/call_out_tile/image.img.jpg/1694802555244.jpg?im=Resize=(193)", "pageUrl": "/plan-your-visit/groups-and-parties.html"}, {"src": "/things-to-do/reeses-stuff-your-cup-ingredients/_jcr_content/root/container/section_article_over/col1/section_copy/col2/image.coreimg.png/1677778544157/reeses-syc-logo.png", "pageUrl": "/things-to-do/reeses-stuff-your-cup-ingredients.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}, {"src": "/content/dam/tenant-alpha-chocolate-world/images/buy-tickets/buy-tickets-split-callout-meal-deal.jpg?im=Resize=(603)", "pageUrl": "/tickets.html"}]}, "finalUrl": "https://tenant-alpha-secondary.com"}'::jsonb,
    'https://tenant-alpha-secondary.com',
    true,
    false,
    NULL,
    '2025-02-26T15:51:57.343Z'::timestamptz,
    '2025-02-26T15:51:57.344Z'::timestamptz,
    '2025-02-26T15:51:57.347Z'::timestamptz,
    'system'
);

-- Opportunities
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '698054e3-3fbd-4b1d-bca1-37c094217e82',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report Week 12 - 2025',
    'A web accessibility audit is an assessment of how well your website and digital assets conform to the needs of people with disabilities and if they follow the Web Content Accessibility Guidelines (WCAG).',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-03-13T15:27:12.562Z'::timestamptz,
    '2025-03-13T15:27:12.563Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '8890223a-358c-4f61-97d7-41f72d74b854',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report Week 12 - 2025 - in-depth',
    'This report provides an in-depth overview of various accessibility issues identified across different web pages. It categorizes issues based on their severity and impact, offering detailed descriptions and recommended fixes. The report covers critical aspects such as ARIA attributes, keyboard navigation, and screen reader compatibility to ensure a more inclusive and accessible web experience for all users.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-03-14T11:52:52.699Z'::timestamptz,
    '2025-03-14T11:52:52.701Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '7803bf52-5f7c-4407-a27c-b6f51f07c997',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Enhancing accessibility for the top 10 most-visited pages',
    'Here are some optimization suggestions that could help solve the accessibility issues found on the top 10 most-visited pages',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-03-14T12:07:35.441Z'::timestamptz,
    '2025-03-14T12:07:35.442Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'b3ed2031-0d1a-4107-9f33-21df545ebd52',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report Week 13 - 2025 - in-depth',
    'This report provides an in-depth overview of various accessibility issues identified across different web pages. It categorizes issues based on their severity and impact, offering detailed descriptions and recommended fixes. The report covers critical aspects such as ARIA attributes, keyboard navigation, and screen reader compatibility to ensure a more inclusive and accessible web experience for all users.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-03-26T14:11:59.449Z'::timestamptz,
    '2025-03-26T14:11:59.450Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '9de4cffb-5be1-4647-a169-3b71b31aea83',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Enhancing accessibility for the top 10 most-visited pages - Desktop - Week 13 - 2025',
    'Here are some optimization suggestions that could help solve the accessibility issues found on the top 10 most-visited pages.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-03-26T14:26:23.287Z'::timestamptz,
    '2025-03-26T14:44:07.094Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '6486da2a-2327-4f14-b75e-4ec16d7bdc82',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 13 - 2025',
    'A web accessibility audit is an assessment of how well your website and digital assets conform to the needs of people with disabilities and if they follow the Web Content Accessibility Guidelines (WCAG). Desktop only version.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-03-26T14:10:17.608Z'::timestamptz,
    '2025-03-26T14:46:00.655Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'fd61d378-fccf-4f13-a47e-067e74bf7f27',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Enhancing accessibility for the top 10 most-visited pages -Desktop - Week 14',
    'Here are some optimization suggestions that could help solve the accessibility issues found on the top 10 most-visited pages.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-02T12:34:21.373Z'::timestamptz,
    '2025-04-02T12:34:21.374Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '0c9e2e1f-c2b2-45df-8e66-eb0a18ea781c',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 14 - 2025 - in-depth',
    'This report provides an in-depth overview of various accessibility issues identified across different web pages. It categorizes issues based on their severity and impact, offering detailed descriptions and recommended fixes. The report covers critical aspects such as ARIA attributes, keyboard navigation, and screen reader compatibility to ensure a more inclusive and accessible web experience for all users.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-02T12:34:49.762Z'::timestamptz,
    '2025-04-02T12:34:49.762Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '5f257522-2b5a-4b15-8398-d26313aaa963',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 15 - 2025 - in-depth',
    'This report provides an in-depth overview of various accessibility issues identified across different web pages. It categorizes issues based on their severity and impact, offering detailed descriptions and recommended fixes. The report covers critical aspects such as ARIA attributes, keyboard navigation, and screen reader compatibility to ensure a more inclusive and accessible web experience for all users.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-08T14:27:52.179Z'::timestamptz,
    '2025-04-08T14:27:52.180Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '0be4cab5-ee72-428f-b936-ef213c31d2c2',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Enhancing accessibility for the top 10 most-visited pages - Desktop - Week 15 - 2025',
    'Here are some optimization suggestions that could help solve the accessibility issues found on the top 10 most-visited pages.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-08T14:28:07.846Z'::timestamptz,
    '2025-04-08T14:28:07.848Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'd214f3b9-619a-4a0a-ab12-dd5a41d70e62',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 16 - 2025 - in-depth',
    'This report provides an in-depth overview of various accessibility issues identified across different web pages. It categorizes issues based on their severity and impact, offering detailed descriptions and recommended fixes. The report covers critical aspects such as ARIA attributes, keyboard navigation, and screen reader compatibility to ensure a more inclusive and accessible web experience for all users.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-15T14:49:57.793Z'::timestamptz,
    '2025-04-15T14:49:57.794Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '879ed275-54ff-4910-9dda-5b12d4531852',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report Fixed vs New Issues - Desktop - Week 16 - 2025',
    'This report provides a comprehensive analysis of accessibility issues, highlighting both resolved and newly identified problems. It aims to track progress in improving accessibility and identify areas requiring further attention.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-15T14:50:07.315Z'::timestamptz,
    '2025-04-15T14:50:07.317Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'f116a366-b8af-46bd-b711-4f70e2d8b2f1',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Enhancing accessibility for the top 10 most-visited pages - Desktop - Week 16 - 2025',
    'Here are some optimization suggestions that could help solve the accessibility issues found on the top 10 most-visited pages.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-15T14:50:18.912Z'::timestamptz,
    '2025-04-15T14:50:18.913Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '4dd4039b-65c4-4e03-9209-e3f869a565d8',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 14 - 2025',
    'A web accessibility audit is an assessment of how well your website and digital assets conform to the needs of people with disabilities and if they follow the Web Content Accessibility Guidelines (WCAG). Desktop only.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-02T12:32:57.059Z'::timestamptz,
    '2025-04-17T12:44:51.120Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '05a3b8bf-7513-4332-a77c-e36ca638fe03',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 15 - 2025',
    'A web accessibility audit is an assessment of how well your website and digital assets conform to the needs of people with disabilities and if they follow the Web Content Accessibility Guidelines (WCAG). Desktop only.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-08T14:29:34.916Z'::timestamptz,
    '2025-04-17T12:44:59.571Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '0b10d7eb-ff98-4298-b11d-39811de73be1',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 17 - 2025 - in-depth',
    'This report provides an in-depth overview of various accessibility issues identified across different web pages. It categorizes issues based on their severity and impact, offering detailed descriptions and recommended fixes. The report covers critical aspects such as ARIA attributes, keyboard navigation, and screen reader compatibility to ensure a more inclusive and accessible web experience for all users.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-23T14:55:04.478Z'::timestamptz,
    '2025-04-23T14:55:04.480Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '225e5ab1-60e5-4c27-a92c-e07a215b512d',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report Fixed vs New Issues - Desktop - Week 17 - 2025',
    'This report provides a comprehensive analysis of accessibility issues, highlighting both resolved and newly identified problems. It aims to track progress in improving accessibility and identify areas requiring further attention.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-23T14:55:12.915Z'::timestamptz,
    '2025-04-23T14:55:12.916Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'c3bec7ea-7c6b-47b5-88f3-6b67af8ee60a',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Enhancing accessibility for the top 10 most-visited pages - Desktop - Week 17 - 2025',
    'Here are some optimization suggestions that could help solve the accessibility issues found on the top 10 most-visited pages.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-23T14:55:22.169Z'::timestamptz,
    '2025-04-23T14:55:22.169Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '22aad080-3d1b-4dc0-b45e-ad4268490e5c',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 16 - 2025',
    'A web accessibility audit is an assessment of how well your website and digital assets conform to the needs of people with disabilities and if they follow the Web Content Accessibility Guidelines (WCAG). Desktop only.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-15T14:51:15.984Z'::timestamptz,
    '2025-04-23T14:56:33.687Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '6ef2b19d-d4e8-4f18-b242-f29bd767ba82',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 18 - 2025 - in-depth',
    'This report provides an in-depth overview of various accessibility issues identified across different web pages. It categorizes issues based on their severity and impact, offering detailed descriptions and recommended fixes. The report covers critical aspects such as ARIA attributes, keyboard navigation, and screen reader compatibility to ensure a more inclusive and accessible web experience for all users.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-30T14:56:48.097Z'::timestamptz,
    '2025-04-30T14:56:48.099Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'ec9aaffd-97da-47e7-a5d9-faf8dc044b23',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report Fixed vs New Issues - Desktop - Week 18 - 2025',
    'This report provides a comprehensive analysis of accessibility issues, highlighting both resolved and newly identified problems. It aims to track progress in improving accessibility and identify areas requiring further attention.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-30T14:57:06.328Z'::timestamptz,
    '2025-04-30T14:57:06.328Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '95088985-4db9-4d6d-8505-eb8ba6a5f404',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Enhancing accessibility for the top 10 most-visited pages - Desktop - Week 18 - 2025',
    'Here are some optimization suggestions that could help solve the accessibility issues found on the top 10 most-visited pages.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-30T14:57:18.091Z'::timestamptz,
    '2025-04-30T14:57:18.092Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'a8fe5fd4-9486-449e-85b4-5812227ddcaa',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 17 - 2025',
    'A web accessibility audit is an assessment of how well your website and digital assets conform to the needs of people with disabilities and if they follow the Web Content Accessibility Guidelines (WCAG). Desktop only.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-23T14:56:22.193Z'::timestamptz,
    '2025-04-30T14:59:29.512Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'd734deeb-1b96-4656-8391-d1eae650bc15',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 18 - 2025',
    'A web accessibility audit is an assessment of how well your website and digital assets conform to the needs of people with disabilities and if they follow the Web Content Accessibility Guidelines (WCAG). Desktop only.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-04-30T14:58:30.262Z'::timestamptz,
    '2025-05-09T11:38:49.368Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'd4754c8c-ef65-476d-a074-d67dd0512c0d',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 19 - 2025 - in-depth',
    'This report provides an in-depth overview of various accessibility issues identified across different web pages. It categorizes issues based on their severity and impact, offering detailed descriptions and recommended fixes. The report covers critical aspects such as ARIA attributes, keyboard navigation, and screen reader compatibility to ensure a more inclusive and accessible web experience for all users.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-05-09T11:38:57.241Z'::timestamptz,
    '2025-05-09T11:38:57.243Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'faabb5f9-37db-4671-8de9-15e989ffa9e9',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report Fixed vs New Issues - Desktop - Week 19 - 2025',
    'This report provides a comprehensive analysis of accessibility issues, highlighting both resolved and newly identified problems. It aims to track progress in improving accessibility and identify areas requiring further attention.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-05-09T11:39:10.908Z'::timestamptz,
    '2025-05-09T11:39:10.910Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '0448b8bb-34eb-4ed6-b963-989339b667b4',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Enhancing accessibility for the top 10 most-visited pages - Desktop - Week 19 - 2025',
    'Here are some optimization suggestions that could help solve the accessibility issues found on the top 10 most-visited pages.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-05-09T11:39:23.674Z'::timestamptz,
    '2025-05-09T11:39:23.675Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'c5470bcd-1844-442c-bd1e-8d87fd60c95b',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    '{"dataSources": ["Ahrefs"]}'::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 19 - 2025',
    'A web accessibility audit is an assessment of how well your website and digital assets conform to the needs of people with disabilities and if they follow the Web Content Accessibility Guidelines (WCAG). Desktop only.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-05-09T11:40:26.439Z'::timestamptz,
    '2025-05-16T12:49:57.843Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '6f3aceb8-bf54-4cae-9fff-d72ea8fe715c',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    '{"dataSources": ["Ahrefs", "GSC", "Site", "RUM"]}'::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report - Desktop - Week 20 - 2025 - in-depth',
    'This report provides an in-depth overview of various accessibility issues identified across different web pages. It categorizes issues based on their severity and impact, offering detailed descriptions and recommended fixes. The report covers critical aspects such as ARIA attributes, keyboard navigation, and screen reader compatibility to ensure a more inclusive and accessible web experience for all users.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-05-16T12:50:17.738Z'::timestamptz,
    '2025-05-16T12:50:17.739Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '9e8a6770-bc19-4222-b931-072b1471b520',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    NULL,
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    '{"dataSources": ["Ahrefs", "GSC", "Site", "RUM"]}'::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Accessibility report Fixed vs New Issues - Desktop - Week 20 - 2025',
    'This report provides a comprehensive analysis of accessibility issues, highlighting both resolved and newly identified problems. It aims to track progress in improving accessibility and identify areas requiring further attention.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-05-16T12:50:30.499Z'::timestamptz,
    '2025-05-16T12:50:30.500Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'ab889047-061d-421f-9e5f-1019c940bdc9',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '4c081ef7-f4f8-4ae0-828c-98f145d16be2',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/Ebpoflp2gHFNl4w5-9C7dFEBBHHE4gTaRzHaofqSxJMuuQ?e=Ss6mep',
    'form-accessibility',
    '{"accessibility": [{"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#birthday-form form#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\"", "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Form elements must have labels", "level": "A"}]}]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form accessibility report',
    NULL,
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Accessibility']::text[],
    '2025-07-20T07:07:14.441Z'::timestamptz,
    '2025-08-06T09:22:06.291Z'::timestamptz,
    '81421F83631C33D70A495CDD@7eeb20f8631c0cb7495c06.e'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '7b5924b3-2329-4f96-8dad-fcab6c536281',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '433ddb38-2b08-4c96-b022-a8f59c818fc4',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/Ebpoflp2gHFNl4w5-9C7dFEBBHHE4gTaRzHaofqSxJMuuQ?e=Ss6mep',
    'form-accessibility',
    '{"accessibility": [{"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#birthday-form form#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\"", "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Form elements must have labels", "level": "A"}]}]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form accessibility report',
    NULL,
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Accessibility']::text[],
    '2025-07-13T07:05:09.320Z'::timestamptz,
    '2025-08-06T09:22:07.153Z'::timestamptz,
    '81421F83631C33D70A495CDD@7eeb20f8631c0cb7495c06.e'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'bd46de8e-c69f-4def-baf3-577a0fee05e7',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '98ef0dcf-25af-4b89-adbf-f0c33a44c46c',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/Ebpoflp2gHFNl4w5-9C7dFEBBHHE4gTaRzHaofqSxJMuuQ?e=Ss6mep',
    'form-accessibility',
    '{"accessibility": [{"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#birthday-form form#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\"", "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Form elements must have labels", "level": "A"}]}]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form accessibility report',
    NULL,
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Accessibility']::text[],
    '2025-07-06T07:04:59.040Z'::timestamptz,
    '2025-08-06T09:22:07.379Z'::timestamptz,
    '81421F83631C33D70A495CDD@7eeb20f8631c0cb7495c06.e'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '96a5ce3b-ba65-4281-ae49-0475f09a9730',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '270a36e0-dbca-4750-a27f-2d7f1c40b260',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/Ebpoflp2gHFNl4w5-9C7dFEBBHHE4gTaRzHaofqSxJMuuQ?e=Ss6mep',
    'form-accessibility',
    '{"accessibility": [{"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#birthday-form form#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\"", "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Form elements must have labels", "level": "A"}]}]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form Accessibility Issues',
    'Form Accessibility Issues',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Accessibility']::text[],
    '2025-06-22T07:04:17.989Z'::timestamptz,
    '2025-08-06T09:22:08.851Z'::timestamptz,
    '81421F83631C33D70A495CDD@7eeb20f8631c0cb7495c06.e'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '12c7d386-e45e-4aee-8637-99cf266ed291',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'fd027055-ffe2-4bb1-86af-7cf36fff44cf',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/Ebpoflp2gHFNl4w5-9C7dFEBBHHE4gTaRzHaofqSxJMuuQ?e=Ss6mep',
    'form-accessibility',
    '{"accessibility": [{"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#birthday-form form#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\"", "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Form elements must have labels", "level": "A"}]}]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form Accessibility Issues',
    'Form Accessibility Issues',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Accessibility']::text[],
    '2025-06-29T07:03:39.306Z'::timestamptz,
    '2025-08-06T09:22:10.771Z'::timestamptz,
    '81421F83631C33D70A495CDD@7eeb20f8631c0cb7495c06.e'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '457316da-a35b-4c77-a096-92204e27d261',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'bed1f8a8-7ca5-4438-8b6a-5bf410628018',
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Accessibility report - Desktop - Week 32 - 2025 - in-depth',
    'This report provides an in-depth overview of various accessibility issues identified across different web pages. It categorizes issues based on their severity and impact, offering detailed descriptions and recommended fixes. The report covers critical aspects such as ARIA attributes, keyboard navigation, and screen reader compatibility to ensure a more inclusive and accessible web experience for all users.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-08-07T12:56:43.316Z'::timestamptz,
    '2025-08-07T12:56:43.352Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '8eac64fc-6cbd-446c-a013-3b6673c45ec8',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'bed1f8a8-7ca5-4438-8b6a-5bf410628018',
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Enhancing accessibility for the top 10 most-visited pages - Desktop - Week 32 - 2025',
    'Here are some optimization suggestions that could help solve the accessibility issues found on the top 10 most-visited pages.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-08-07T12:56:43.369Z'::timestamptz,
    '2025-08-07T12:56:43.401Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '67d78d76-7ead-479d-a02e-360b0f23b1d4',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '054ae59b-b6d2-4454-869f-cd85752609dc',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/Ebpoflp2gHFNl4w5-9C7dFEBBHHE4gTaRzHaofqSxJMuuQ?e=Ss6mep',
    'form-accessibility',
    '{"accessibility": [{"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#birthday-form form#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\"", "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Form elements must have labels", "level": "A", "guidance": "Add associated <label> elements to each input so screen readers can identify the purpose of each field. Example: <label for=\"adults\">Number of Adults</label>\n<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">\n<label for=\"youth\">Number of Youth</label>\n<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">\n<label for=\"toddlers\">Number of Toddlers</label>\n<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"}, {"htmlWithIssues": ["<select aria-hidden=\"true\" id=\"country\" name=\"country\" tabindex=\"-1\"><option></option><option value=\"Afghanistan\">Afghanistan</option><option value=\"Albania\">Albania</option><option value=\"Algeria\">Algeria</option><option value=\"American Samoa\">American Samoa</option><option value=\"Angola\">Angola</option><option value=\"Anguilla\">Anguilla</option><option value=\"Antartica\">Antartica</option><option value=\"Antigua and Barbuda\">Antigua and Barbuda</option><option value=\"Argentina\">Argentina</option><option value=\"Armenia\">Armenia</option><option value=\"Aruba\">Aruba</option><option value=\"Ashmore and Cartier Island\">Ashmore and Cartier Island</option><option value=\"Australia\">Australia</option><option value=\"Austria\">Austria</option><option value=\"Azerbaijan\">Azerbaijan</option><option value=\"Bahamas\">Bahamas</option><option value=\"Bahrain\">Bahrain</option><option value=\"Bangladesh\">Bangladesh</option><option value=\"Barbados\">Barbados</option><option value=\"Belarus\">Belarus</option><option value=\"Belgium\">Belgium</option><option value=\"Belize\">Belize</option><option value=\"Benin\">Benin</option><option value=\"Bermuda\">Bermuda</option><option value=\"Bhutan\">Bhutan</option><option value=\"Bolivia\">Bolivia</option><option value=\"Bosnia and Herzegovina\">Bosnia and Herzegovina</option><option value=\"Botswana\">Botswana</option><option value=\"Brazil\">Brazil</option><option value=\"British Virgin Islands\">British Virgin Islands</option><option value=\"Brunei\">Brunei</option><option value=\"Bulgaria\">Bulgaria</option><option value=\"Burkina Faso\">Burkina Faso</option><option value=\"Burma\">Burma</option><option value=\"Burundi\">Burundi</option><option value=\"Cambodia\">Cambodia</option><option value=\"Cameroon\">Cameroon</option><option value=\"Canada\">Canada</option><option value=\"Cape Verde\">Cape Verde</option><option value=\"Cayman Islands\">Cayman Islands</option><option value=\"Central African Republic\">Central African Republic</option><option value=\"Chad\">Chad</option><option value=\"Chile\">Chile</option><option value=\"China\">China</option><option value=\"Christmas Island\">Christmas Island</option><option value=\"Clipperton Island\">Clipperton Island</option><option value=\"Cocos (Keeling) Islands\">Cocos (Keeling) Islands</option><option value=\"Colombia\">Colombia</option><option value=\"Comoros\">Comoros</option><option value=\"Congo, Democratic Republic of the\">Congo, Democratic Republic of the</option><option value=\"Congo, Republic of the\">Congo, Republic of the</option><option value=\"Cook Islands\">Cook Islands</option><option value=\"Costa Rica\">Costa Rica</option><option value=\"Cote d''Ivoire\">Cote d''Ivoire</option><option value=\"Croatia\">Croatia</option><option value=\"Cuba\">Cuba</option><option value=\"Cyprus\">Cyprus</option><option value=\"Czeck Republic\">Czeck Republic</option><option value=\"Denmark\">Denmark</option><option value=\"Djibouti\">Djibouti</option><option value=\"Dominica\">Dominica</option><option value=\"Dominican Republic\">Dominican Republic</option><option value=\"Ecuador\">Ecuador</option><option value=\"Egypt\">Egypt</option><option value=\"El Salvador\">El Salvador</option><option value=\"Equatorial Guinea\">Equatorial Guinea</option><option value=\"Eritrea\">Eritrea</option><option value=\"Estonia\">Estonia</option><option value=\"Ethiopia\">Ethiopia</option><option value=\"Europa Island\">Europa Island</option><option value=\"Falkland Islands\">Falkland Islands</option><option value=\"Faroe Islands\">Faroe Islands</option><option value=\"Fiji\">Fiji</option><option value=\"Finland\">Finland</option><option value=\"France\">France</option><option value=\"French Guiana\">French Guiana</option><option value=\"French Polynesia\">French Polynesia</option><option value=\"French Southern and Antarctic Lands\">French Southern and Antarctic Lands</option><option value=\"Gabon\">Gabon</option><option value=\"Gambia, The\">Gambia, The</option><option value=\"Georgia\">Georgia</option><option value=\"Germany\">Germany</option><option value=\"Ghana\">Ghana</option><option value=\"Gibraltar\">Gibraltar</option><option value=\"Glorioso Islands\">Glorioso Islands</option><option value=\"Greece\">Greece</option><option value=\"Greenland\">Greenland</option><option value=\"Grenada\">Grenada</option><option value=\"Guadeloupe\">Guadeloupe</option><option value=\"Guam\">Guam</option><option value=\"Guatemala\">Guatemala</option><option value=\"Guernsey\">Guernsey</option><option value=\"Guinea\">Guinea</option><option value=\"Guinea-Bissau\">Guinea-Bissau</option><option value=\"Guyana\">Guyana</option><option value=\"Haiti\">Haiti</option><option value=\"Heard Island and McDonald Islands\">Heard Island and McDonald Islands</option><option value=\"Holy See (Vatican City)\">Holy See (Vatican City)</option><option value=\"Honduras\">Honduras</option><option value=\"Hong Kong\">Hong Kong</option><option value=\"Howland Island\">Howland Island</option><option value=\"Hungary\">Hungary</option><option value=\"Iceland\">Iceland</option><option value=\"India\">India</option><option value=\"Indonesia\">Indonesia</option><option value=\"Iran\">Iran</option><option value=\"Iraq\">Iraq</option><option value=\"Ireland\">Ireland</option><option value=\"Ireland, Northern\">Ireland, Northern</option><option value=\"Israel\">Israel</option><option value=\"Italy\">Italy</option><option value=\"Jamaica\">Jamaica</option><option value=\"Jan Mayen\">Jan Mayen</option><option value=\"Japan\">Japan</option><option value=\"Jarvis Island\">Jarvis Island</option><option value=\"Jersey\">Jersey</option><option value=\"Johnston Atoll\">Johnston Atoll</option><option value=\"Jordan\">Jordan</option><option value=\"Juan de Nova Island\">Juan de Nova Island</option><option value=\"Kazakhstan\">Kazakhstan</option><option value=\"Kenya\">Kenya</option><option value=\"Kiribati\">Kiribati</option><option value=\"Korea, North\">Korea, North</option><option value=\"Korea, South\">Korea, South</option><option value=\"Kuwait\">Kuwait</option><option value=\"Kyrgyzstan\">Kyrgyzstan</option><option value=\"Laos\">Laos</option><option value=\"Latvia\">Latvia</option><option value=\"Lebanon\">Lebanon</option><option value=\"Lesotho\">Lesotho</option><option value=\"Liberia\">Liberia</option><option value=\"Libya\">Libya</option><option value=\"Liechtenstein\">Liechtenstein</option><option value=\"Lithuania\">Lithuania</option><option value=\"Luxembourg\">Luxembourg</option><option value=\"Macau\">Macau</option><option value=\"Macedonia, Former Yugoslav Republic of\">Macedonia, Former Yugoslav Republic of</option><option value=\"Madagascar\">Madagascar</option><option value=\"Malawi\">Malawi</option><option value=\"Malaysia\">Malaysia</option><option value=\"Maldives\">Maldives</option><option value=\"Mali\">Mali</option><option value=\"Malta\">Malta</option><option value=\"Man, Isle of\">Man, Isle of</option><option value=\"Marshall Islands\">Marshall Islands</option><option value=\"Martinique\">Martinique</option><option value=\"Mauritania\">Mauritania</option><option value=\"Mauritius\">Mauritius</option><option value=\"Mayotte\">Mayotte</option><option value=\"Mexico\">Mexico</option><option value=\"Micronesia\">Micronesia</option><option value=\"Midway Islands\">Midway Islands</option><option value=\"Moldova\">Moldova</option><option value=\"Monaco\">Monaco</option><option value=\"Mongolia\">Mongolia</option><option value=\"Montserrat\">Montserrat</option><option value=\"Morocco\">Morocco</option><option value=\"Mozambique\">Mozambique</option><option value=\"Namibia\">Namibia</option><option value=\"Nauru\">Nauru</option><option value=\"Nepal\">Nepal</option><option value=\"Netherlands\">Netherlands</option><option value=\"Netherlands Antilles\">Netherlands Antilles</option><option value=\"New Caledonia\">New Caledonia</option><option value=\"New Zealand\">New Zealand</option><option value=\"Nicaragua\">Nicaragua</option><option value=\"Niger\">Niger</option><option value=\"Nigeria\">Nigeria</option><option value=\"Niue\">Niue</option><option value=\"Norfolk Island\">Norfolk Island</option><option value=\"Northern Mariana Islands\">Northern Mariana Islands</option><option value=\"Norway\">Norway</option><option value=\"Oman\">Oman</option><option value=\"Pakistan\">Pakistan</option><option value=\"Palau\">Palau</option><option value=\"Panama\">Panama</option><option value=\"Papua New Guinea\">Papua New Guinea</option><option value=\"Paraguay\">Paraguay</option><option value=\"Peru\">Peru</option><option value=\"Philippines\">Philippines</option><option value=\"Pitcaim Islands\">Pitcaim Islands</option><option value=\"Poland\">Poland</option><option value=\"Portugal\">Portugal</option><option value=\"Puerto Rico\">Puerto Rico</option><option value=\"Qatar\">Qatar</option><option value=\"Reunion\">Reunion</option><option value=\"Romainia\">Romainia</option><option value=\"Russia\">Russia</option><option value=\"Rwanda\">Rwanda</option><option value=\"Saint Helena\">Saint Helena</option><option value=\"Saint Kitts and Nevis\">Saint Kitts and Nevis</option><option value=\"Saint Lucia\">Saint Lucia</option><option value=\"Saint Pierre and Miquelon\">Saint Pierre and Miquelon</option><option value=\"Saint Vincent and the Grenadines\">Saint Vincent and the Grenadines</option><option value=\"Samoa\">Samoa</option><option value=\"San Marino\">San Marino</option><option value=\"Sao Tome and Principe\">Sao Tome and Principe</option><option value=\"Saudi Arabia\">Saudi Arabia</option><option value=\"Scotland\">Scotland</option><option value=\"Senegal\">Senegal</option><option value=\"Seychelles\">Seychelles</option><option value=\"Sierra Leone\">Sierra Leone</option><option value=\"Singapore\">Singapore</option><option value=\"Slovakia\">Slovakia</option><option value=\"Slovenia\">Slovenia</option><option value=\"Solomon Islands\">Solomon Islands</option><option value=\"Somalia\">Somalia</option><option value=\"South Africa\">South Africa</option><option value=\"South Georgia and South Sandwich Islands\">South Georgia and South Sandwich Islands</option><option value=\"Spain\">Spain</option><option value=\"Spratly Islands\">Spratly Islands</option><option value=\"Sri Lanka\">Sri Lanka</option><option value=\"Sudan\">Sudan</option><option value=\"Suriname\">Suriname</option><option value=\"Svalbard and Jan Mayen\">Svalbard and Jan Mayen</option><option value=\"Swaziland\">Swaziland</option><option value=\"Sweden\">Sweden</option><option value=\"Switzerland\">Switzerland</option><option value=\"Syria\">Syria</option><option value=\"Taiwan\">Taiwan</option><option value=\"Tajikistan\">Tajikistan</option><option value=\"Tanzania\">Tanzania</option><option value=\"Thailand\">Thailand</option><option value=\"Tobago\">Tobago</option><option value=\"Togo\">Togo</option><option value=\"Tokelau\">Tokelau</option><option value=\"Tonga\">Tonga</option><option value=\"Trinidad and Tobago\">Trinidad and Tobago</option><option value=\"Tunisia\">Tunisia</option><option value=\"Turkey\">Turkey</option><option value=\"Turkmenistan\">Turkmenistan</option><option value=\"Tuvalu\">Tuvalu</option><option value=\"Uganda\">Uganda</option><option value=\"Ukraine\">Ukraine</option><option value=\"United Arab Emirates\">United Arab Emirates</option><option value=\"United Kingdom\">United Kingdom</option><option value=\"United States\">United States</option><option value=\"Uruguay\">Uruguay</option><option value=\"Uzbekistan\">Uzbekistan</option><option value=\"Vanuatu\">Vanuatu</option><option value=\"Venezuela\">Venezuela</option><option value=\"Vietnam\">Vietnam</option><option value=\"Virgin Islands\">Virgin Islands</option><option value=\"Wales\">Wales</option><option value=\"Wallis and Futuna\">Wallis and Futuna</option><option value=\"West Bank\">West Bank</option><option value=\"Western Sahara\">Western Sahara</option><option value=\"Yemen\">Yemen</option><option value=\"Yugoslavia\">Yugoslavia</option><option value=\"Zambia\">Zambia</option><option value=\"Zimbabwe\">Zimbabwe</option></select>", "<select aria-hidden=\"true\" id=\"state\" name=\"state\" tabindex=\"-1\"><option disabled=\"\" hidden=\"\" selected=\"\" value=\"\">\uf74d Choose a State</option><option value=\"Alabama\">Alabama</option><option value=\"Alaska\">Alaska</option><option value=\"Arizona\">Arizona</option><option value=\"Arkansas\">Arkansas</option><option value=\"California\">California</option><option value=\"Colorado\">Colorado</option><option value=\"Connecticut\">Connecticut</option><option value=\"Delaware\">Delaware</option><option value=\"District of Columbia\">District of Columbia</option><option value=\"Florida\">Florida</option><option value=\"Georgia\">Georgia</option><option value=\"Hawaii\">Hawaii</option><option value=\"Idaho\">Idaho</option><option value=\"Illinois\">Illinois</option><option value=\"Indiana\">Indiana</option><option value=\"Iowa\">Iowa</option><option value=\"Kansas\">Kansas</option><option value=\"Kentucky\">Kentucky</option><option value=\"Louisiana\">Louisiana</option><option value=\"Maine\">Maine</option><option value=\"Maryland\">Maryland</option><option value=\"Massachusetts\">Massachusetts</option><option value=\"Michigan\">Michigan</option><option value=\"Minnesota\">Minnesota</option><option value=\"Mississippi\">Mississippi</option><option value=\"Missouri\">Missouri</option><option value=\"Montana\">Montana</option><option value=\"Nebraska\">Nebraska</option><option value=\"Nevada\">Nevada</option><option value=\"New Hampshire\">New Hampshire</option><option value=\"New Jersey\">New Jersey</option><option value=\"New Mexico\">New Mexico</option><option value=\"New York\">New York</option><option value=\"North Carolina\">North Carolina</option><option value=\"North Dakota\">North Dakota</option><option value=\"Ohio\">Ohio</option><option value=\"Oklahoma\">Oklahoma</option><option value=\"Oregon\">Oregon</option><option value=\"Pennsylvania\">Pennsylvania</option><option value=\"Rhode Island\">Rhode Island</option><option value=\"South Carolina\">South Carolina</option><option value=\"South Dakota\">South Dakota</option><option value=\"Tennessee\">Tennessee</option><option value=\"Texas\">Texas</option><option value=\"Utah\">Utah</option><option value=\"Vermont\">Vermont</option><option value=\"Virginia\">Virginia</option><option value=\"Washington\">Washington</option><option value=\"West Virginia\">West Virginia</option><option value=\"Wisconsin\">Wisconsin</option><option value=\"Wyoming\">Wyoming</option></select>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}, {"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Country, State selects are not accessible to assistive technologies due to aria-hidden and tabindex=-1", "aiGenerated": true, "level": "A", "guidance": "Remove aria-hidden=\"true\" and tabindex=\"-1\" from <select> elements so that they are accessible to assistive technologies. Example: <label for=\"country\">Country</label>\n<select id=\"country\" name=\"country\">\n  <option></option>\n  <option value=\"Afghanistan\">Afghanistan</option>\n  <!-- Other country options -->\n</select>\n<label for=\"state\">State</label>\n<select id=\"state\" name=\"state\">\n  <option disabled hidden selected value=\"\">&#xf74d; Choose a State</option>\n  <option value=\"Alabama\">Alabama</option>\n  <!-- Other state options -->\n</select>", "recommendation": "Remove aria-hidden=\"true\" and tabindex=\"-1\" from the Country and State <select> elements to ensure they are reachable and announced."}, {"htmlWithIssues": ["<input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/>,<input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/>,<input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/>,<input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/>", "<input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\"/>", "<input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/>,<input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/>,<input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/>", "<input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\"/>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}], "issue": "Party Package, Add-on Options, Are you interested in any add-on options?, Are you the point of contact during the day of arrival for this group? groups are not grouped using fieldset/legend or role=\"group\" + aria-labelledby", "aiGenerated": true, "level": "A", "guidance": "Wrap each group of related form inputs and their labels in a <fieldset> with a <legend> describing the group for semantic grouping and screen reader clarity. Example: <fieldset>\n  <legend>Party Package</legend>\n  <input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\" />\n  <label for=\"King Size\">King Size</label>\n  <input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\" />\n  <label for=\"Standard Size\">Standard Size</label>\n  <input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\" />\n  <label for=\"Snack Size\">Snack Size</label>\n  <input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\" />\n  <label for=\"Bite Size\">Bite Size</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you interested in any add-on options?</legend>\n  <input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"addonOptionYes\">Yes</label>\n  <input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"addonOptionNo\">No</label>\n</fieldset>\n\n<fieldset>\n  <legend>Add-on Options</legend>\n  <input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\" />\n  <label for=\"addonOpt1\">Food</label>\n  <input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\" />\n  <label for=\"addonOpt2\">Retail</label>\n  <input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\" />\n  <label for=\"addonOpt3\">Photos</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you the point of contact during the day of arrival for this group?</legend>\n  <input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"arrivalQuestionYes\">Yes</label>\n  <input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"arrivalQuestionNo\">No</label>\n</fieldset>", "recommendation": "Wrap each group of related radio or checkbox inputs and their labels and error messages in a <fieldset> with a <legend> or a container with role=\"group\" and aria-labelledby pointing to a visible label."}, {"htmlWithIssues": ["<input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/>", "<input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/>", "<input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/>", "<input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}, {"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Party Package radio button group is not grouped using fieldset/legend or role=\"group\" with aria-labelledby", "aiGenerated": null, "level": "A", "guidance": "Group the Party Package radio buttons within a <fieldset> and provide a <legend> to describe the group. Example: <fieldset>\n  <legend>Party Package</legend>\n  <input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\" />\n  <label for=\"King Size\">King Size</label>\n  <input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\" />\n  <label for=\"Standard Size\">Standard Size</label>\n  <input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\" />\n  <label for=\"Snack Size\">Snack Size</label>\n  <input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\" />\n  <label for=\"Bite Size\">Bite Size</label>\n</fieldset>", "recommendation": "Group the Party Package radio buttons within a <fieldset> with a <legend>, or use a container with role=\"group\" and aria-labelledby referencing a label."}, {"htmlWithIssues": ["<input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/>", "<input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/>", "<input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}, {"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Add-on Options checkbox group is not grouped using fieldset/legend or role=\"group\" with aria-labelledby", "aiGenerated": null, "level": "A", "guidance": "Group the Add-on Options checkboxes within a <fieldset> and use a <legend> to describe the group for accessible context. Example: <fieldset>\n  <legend>Add-on Options</legend>\n  <input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\" />\n  <label for=\"addonOpt1\">Food</label>\n  <input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\" />\n  <label for=\"addonOpt2\">Retail</label>\n  <input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\" />\n  <label for=\"addonOpt3\">Photos</label>\n</fieldset>", "recommendation": "Group Add-on Options checkboxes within a <fieldset> with a <legend>, or use a container with role=\"group\" and aria-labelledby referencing a label."}]}, {"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#container-a10f7aecc3 form#signupForm", "a11yIssues": [{"htmlWithIssues": ["<select aria-hidden=\"true\" id=\"country\" name=\"country\" tabindex=\"-1\"><option></option><option value=\"Afghanistan\">Afghanistan</option>...<option value=\"Zimbabwe\">Zimbabwe</option></select>", "<select aria-hidden=\"true\" id=\"state\" name=\"state\" tabindex=\"-1\"><option disabled=\"\" hidden=\"\" selected=\"\" value=\"\">\uf74d Choose a State</option><option value=\"Alabama\">Alabama</option>...<option value=\"Wyoming\">Wyoming</option></select>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}, {"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Country, State select elements are not accessible to assistive technologies due to aria-hidden and tabindex=-1", "aiGenerated": null, "level": "A", "guidance": "Remove aria-hidden=\"true\" and tabindex=\"-1\" from the <select> elements to ensure they are accessible to assistive technologies. Example: <label for=\"country\">Country</label>\n<select id=\"country\" name=\"country\">\n  <option></option>\n  <option value=\"Afghanistan\">Afghanistan</option>\n  <!-- Other country options -->\n</select>\n\n<label for=\"state\">State</label>\n<select id=\"state\" name=\"state\">\n  <option disabled hidden selected value=\"\">&#xf74d; Choose a State</option>\n  <option value=\"Alabama\">Alabama</option>\n  <!-- Other state options -->\n</select>", "recommendation": "Remove aria-hidden=\"true\" and tabindex=\"-1\" from the Country and State <select> elements to ensure they are reachable and announced."}, {"htmlWithIssues": ["<input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/>,<input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/>,<input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/>,<input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/>", "<input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\"/>", "<input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/>,<input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/>,<input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/>", "<input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\"/>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}], "issue": "Party Package, Add-on Options, Are you interested in any add-on options?, Are you the point of contact during the day of arrival for this group? input groups are not grouped using fieldset/legend or role=\"group\" + aria-labelledby", "aiGenerated": null, "level": "A", "guidance": "Wrap each input group in a <fieldset> with a <legend> describing the group to provide proper semantic grouping for screen readers. Example: <fieldset>\n  <legend>Party Package</legend>\n  <input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\" />\n  <label for=\"King Size\">King Size</label>\n  <input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\" />\n  <label for=\"Standard Size\">Standard Size</label>\n  <input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\" />\n  <label for=\"Snack Size\">Snack Size</label>\n  <input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\" />\n  <label for=\"Bite Size\">Bite Size</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you interested in any add-on options?</legend>\n  <input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"addonOptionYes\">Yes</label>\n  <input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"addonOptionNo\">No</label>\n</fieldset>\n\n<fieldset>\n  <legend>Add-on Options</legend>\n  <input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\" />\n  <label for=\"addonOpt1\">Food</label>\n  <input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\" />\n  <label for=\"addonOpt2\">Retail</label>\n  <input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\" />\n  <label for=\"addonOpt3\">Photos</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you the point of contact during the day of arrival for this group?</legend>\n  <input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"arrivalQuestionYes\">Yes</label>\n  <input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"arrivalQuestionNo\">No</label>\n</fieldset>", "recommendation": "Wrap all related radio and checkbox input groups, their labels, and error messages in a <fieldset> with a <legend> or a container with role=\"group\" and aria-labelledby pointing to a visible label."}, {"htmlWithIssues": ["<input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/>,<input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/>,<input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/>,<input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/>", "<input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\"/>", "<input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/>,<input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/>,<input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/>", "<input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\"/>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}, {"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Radio button groups ''Party Package'', ''Are you interested in any add-on options?'', ''Are you the point of contact during the day of arrival for this group?'' and checkbox group ''Add-on Options (please check all that apply):'' are not grouped using a fieldset/legend or ARIA group, which may confuse screen reader users.", "aiGenerated": null, "level": "A", "guidance": "Use a <fieldset> with a <legend> to group each radio and checkbox group so assistive technologies announce them together. Example: <fieldset>\n  <legend>Party Package</legend>\n  <input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\" />\n  <label for=\"King Size\">King Size</label>\n  <input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\" />\n  <label for=\"Standard Size\">Standard Size</label>\n  <input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\" />\n  <label for=\"Snack Size\">Snack Size</label>\n  <input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\" />\n  <label for=\"Bite Size\">Bite Size</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you interested in any add-on options?</legend>\n  <input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"addonOptionYes\">Yes</label>\n  <input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"addonOptionNo\">No</label>\n</fieldset>\n\n<fieldset>\n  <legend>Add-on Options</legend>\n  <input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\" />\n  <label for=\"addonOpt1\">Food</label>\n  <input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\" />\n  <label for=\"addonOpt2\">Retail</label>\n  <input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\" />\n  <label for=\"addonOpt3\">Photos</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you the point of contact during the day of arrival for this group?</legend>\n  <input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"arrivalQuestionYes\">Yes</label>\n  <input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"arrivalQuestionNo\">No</label>\n</fieldset>", "recommendation": "Wrap these radio button and checkbox inputs in a <fieldset> with an appropriate <legend> or use a container with role=\"group\" and aria-labelledby referencing a visible label to provide semantic grouping for assistive technology."}]}, {"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/groups.html", "formSource": "#group-form form#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/>,<input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/>,<input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/>,<input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/>", "<input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\"/>", "<input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/>,<input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/>,<input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/>", "<input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\"/>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}, {"name": "Labels or Instructions", "criteriaNumber": "3.3.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html"}], "issue": "Party Package, Are you interested in any add-on options?, Are you the point of contact during the day of arrival for this group? radio button groups and Add-on Options (please check all that apply): checkbox group are not grouped with a <fieldset>/<legend> or accessible ARIA group", "aiGenerated": null, "level": "A", "guidance": "Wrap each group of related radio and checkbox inputs in a <fieldset> with a descriptive <legend> to provide a clear relationship for assistive technologies. Example: <fieldset>\n  <legend>Party Package</legend>\n  <input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\" />\n  <label for=\"King Size\">King Size</label>\n  <input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\" />\n  <label for=\"Standard Size\">Standard Size</label>\n  <input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\" />\n  <label for=\"Snack Size\">Snack Size</label>\n  <input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\" />\n  <label for=\"Bite Size\">Bite Size</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you interested in any add-on options?</legend>\n  <input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"addonOptionYes\">Yes</label>\n  <input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"addonOptionNo\">No</label>\n</fieldset>\n\n<fieldset>\n  <legend>Add-on Options (please check all that apply):</legend>\n  <input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\" />\n  <label for=\"addonOpt1\">Food</label>\n  <input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\" />\n  <label for=\"addonOpt2\">Retail</label>\n  <input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\" />\n  <label for=\"addonOpt3\">Photos</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you the point of contact during the day of arrival for this group?</legend>\n  <input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"arrivalQuestionYes\">Yes</label>\n  <input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"arrivalQuestionNo\">No</label>\n</fieldset>", "recommendation": "Group each set of related radio buttons or checkboxes within a <fieldset> with a descriptive <legend>, or use a container with role=\"group\" and an aria-labelledby reference."}, {"htmlWithIssues": ["<select aria-hidden=\"true\" id=\"country\" name=\"country\" tabindex=\"-1\"><option></option><option value=\"Afghanistan\">Afghanistan</option><option value=\"Albania\">Albania</option><option value=\"Algeria\">Algeria</option><option value=\"American Samoa\">American Samoa</option><option value=\"Angola\">Angola</option><option value=\"Anguilla\">Anguilla</option><option value=\"Antartica\">Antartica</option><option value=\"Antigua and Barbuda\">Antigua and Barbuda</option><option value=\"Argentina\">Argentina</option><option value=\"Armenia\">Armenia</option><option value=\"Aruba\">Aruba</option><option value=\"Ashmore and Cartier Island\">Ashmore and Cartier Island</option><option value=\"Australia\">Australia</option><option value=\"Austria\">Austria</option><option value=\"Azerbaijan\">Azerbaijan</option><option value=\"Bahamas\">Bahamas</option><option value=\"Bahrain\">Bahrain</option><option value=\"Bangladesh\">Bangladesh</option><option value=\"Barbados\">Barbados</option><option value=\"Belarus\">Belarus</option><option value=\"Belgium\">Belgium</option><option value=\"Belize\">Belize</option><option value=\"Benin\">Benin</option><option value=\"Bermuda\">Bermuda</option><option value=\"Bhutan\">Bhutan</option><option value=\"Bolivia\">Bolivia</option><option value=\"Bosnia and Herzegovina\">Bosnia and Herzegovina</option><option value=\"Botswana\">Botswana</option><option value=\"Brazil\">Brazil</option><option value=\"British Virgin Islands\">British Virgin Islands</option><option value=\"Brunei\">Brunei</option><option value=\"Bulgaria\">Bulgaria</option><option value=\"Burkina Faso\">Burkina Faso</option><option value=\"Burma\">Burma</option><option value=\"Burundi\">Burundi</option><option value=\"Cambodia\">Cambodia</option><option value=\"Cameroon\">Cameroon</option><option value=\"Canada\">Canada</option><option value=\"Cape Verde\">Cape Verde</option><option value=\"Cayman Islands\">Cayman Islands</option><option value=\"Central African Republic\">Central African Republic</option><option value=\"Chad\">Chad</option><option value=\"Chile\">Chile</option><option value=\"China\">China</option><option value=\"Christmas Island\">Christmas Island</option><option value=\"Clipperton Island\">Clipperton Island</option><option value=\"Cocos (Keeling) Islands\">Cocos (Keeling) Islands</option><option value=\"Colombia\">Colombia</option><option value=\"Comoros\">Comoros</option><option value=\"Congo, Democratic Republic of the\">Congo, Democratic Republic of the</option><option value=\"Congo, Republic of the\">Congo, Republic of the</option><option value=\"Cook Islands\">Cook Islands</option><option value=\"Costa Rica\">Costa Rica</option><option value=\"Cote d''Ivoire\">Cote d''Ivoire</option><option value=\"Croatia\">Croatia</option><option value=\"Cuba\">Cuba</option><option value=\"Cyprus\">Cyprus</option><option value=\"Czeck Republic\">Czeck Republic</option><option value=\"Denmark\">Denmark</option><option value=\"Djibouti\">Djibouti</option><option value=\"Dominica\">Dominica</option><option value=\"Dominican Republic\">Dominican Republic</option><option value=\"Ecuador\">Ecuador</option><option value=\"Egypt\">Egypt</option><option value=\"El Salvador\">El Salvador</option><option value=\"Equatorial Guinea\">Equatorial Guinea</option><option value=\"Eritrea\">Eritrea</option><option value=\"Estonia\">Estonia</option><option value=\"Ethiopia\">Ethiopia</option><option value=\"Europa Island\">Europa Island</option><option value=\"Falkland Islands\">Falkland Islands</option><option value=\"Faroe Islands\">Faroe Islands</option><option value=\"Fiji\">Fiji</option><option value=\"Finland\">Finland</option><option value=\"France\">France</option><option value=\"French Guiana\">French Guiana</option><option value=\"French Polynesia\">French Polynesia</option><option value=\"French Southern and Antarctic Lands\">French Southern and Antarctic Lands</option><option value=\"Gabon\">Gabon</option><option value=\"Gambia, The\">Gambia, The</option><option value=\"Georgia\">Georgia</option><option value=\"Germany\">Germany</option><option value=\"Ghana\">Ghana</option><option value=\"Gibraltar\">Gibraltar</option><option value=\"Glorioso Islands\">Glorioso Islands</option><option value=\"Greece\">Greece</option><option value=\"Greenland\">Greenland</option><option value=\"Grenada\">Grenada</option><option value=\"Guadeloupe\">Guadeloupe</option><option value=\"Guam\">Guam</option><option value=\"Guatemala\">Guatemala</option><option value=\"Guernsey\">Guernsey</option><option value=\"Guinea\">Guinea</option><option value=\"Guinea-Bissau\">Guinea-Bissau</option><option value=\"Guyana\">Guyana</option><option value=\"Haiti\">Haiti</option><option value=\"Heard Island and McDonald Islands\">Heard Island and McDonald Islands</option><option value=\"Holy See (Vatican City)\">Holy See (Vatican City)</option><option value=\"Honduras\">Honduras</option><option value=\"Hong Kong\">Hong Kong</option><option value=\"Howland Island\">Howland Island</option><option value=\"Hungary\">Hungary</option><option value=\"Iceland\">Iceland</option><option value=\"India\">India</option><option value=\"Indonesia\">Indonesia</option><option value=\"Iran\">Iran</option><option value=\"Iraq\">Iraq</option><option value=\"Ireland\">Ireland</option><option value=\"Ireland, Northern\">Ireland, Northern</option><option value=\"Israel\">Israel</option><option value=\"Italy\">Italy</option><option value=\"Jamaica\">Jamaica</option><option value=\"Jan Mayen\">Jan Mayen</option><option value=\"Japan\">Japan</option><option value=\"Jarvis Island\">Jarvis Island</option><option value=\"Jersey\">Jersey</option><option value=\"Johnston Atoll\">Johnston Atoll</option><option value=\"Jordan\">Jordan</option><option value=\"Juan de Nova Island\">Juan de Nova Island</option><option value=\"Kazakhstan\">Kazakhstan</option><option value=\"Kenya\">Kenya</option><option value=\"Kiribati\">Kiribati</option><option value=\"Korea, North\">Korea, North</option><option value=\"Korea, South\">Korea, South</option><option value=\"Kuwait\">Kuwait</option><option value=\"Kyrgyzstan\">Kyrgyzstan</option><option value=\"Laos\">Laos</option><option value=\"Latvia\">Latvia</option><option value=\"Lebanon\">Lebanon</option><option value=\"Lesotho\">Lesotho</option><option value=\"Liberia\">Liberia</option><option value=\"Libya\">Libya</option><option value=\"Liechtenstein\">Liechtenstein</option><option value=\"Lithuania\">Lithuania</option><option value=\"Luxembourg\">Luxembourg</option><option value=\"Macau\">Macau</option><option value=\"Macedonia, Former Yugoslav Republic of\">Macedonia, Former Yugoslav Republic of</option><option value=\"Madagascar\">Madagascar</option><option value=\"Malawi\">Malawi</option><option value=\"Malaysia\">Malaysia</option><option value=\"Maldives\">Maldives</option><option value=\"Mali\">Mali</option><option value=\"Malta\">Malta</option><option value=\"Man, Isle of\">Man, Isle of</option><option value=\"Marshall Islands\">Marshall Islands</option><option value=\"Martinique\">Martinique</option><option value=\"Mauritania\">Mauritania</option><option value=\"Mauritius\">Mauritius</option><option value=\"Mayotte\">Mayotte</option><option value=\"Mexico\">Mexico</option><option value=\"Micronesia\">Micronesia</option><option value=\"Midway Islands\">Midway Islands</option><option value=\"Moldova\">Moldova</option><option value=\"Monaco\">Monaco</option><option value=\"Mongolia\">Mongolia</option><option value=\"Montserrat\">Montserrat</option><option value=\"Morocco\">Morocco</option><option value=\"Mozambique\">Mozambique</option><option value=\"Namibia\">Namibia</option><option value=\"Nauru\">Nauru</option><option value=\"Nepal\">Nepal</option><option value=\"Netherlands\">Netherlands</option><option value=\"Netherlands Antilles\">Netherlands Antilles</option><option value=\"New Caledonia\">New Caledonia</option><option value=\"New Zealand\">New Zealand</option><option value=\"Nicaragua\">Nicaragua</option><option value=\"Niger\">Niger</option><option value=\"Nigeria\">Nigeria</option><option value=\"Niue\">Niue</option><option value=\"Norfolk Island\">Norfolk Island</option><option value=\"Northern Mariana Islands\">Northern Mariana Islands</option><option value=\"Norway\">Norway</option><option value=\"Oman\">Oman</option><option value=\"Pakistan\">Pakistan</option><option value=\"Palau\">Palau</option><option value=\"Panama\">Panama</option><option value=\"Papua New Guinea\">Papua New Guinea</option><option value=\"Paraguay\">Paraguay</option><option value=\"Peru\">Peru</option><option value=\"Philippines\">Philippines</option><option value=\"Pitcaim Islands\">Pitcaim Islands</option><option value=\"Poland\">Poland</option><option value=\"Portugal\">Portugal</option><option value=\"Puerto Rico\">Puerto Rico</option><option value=\"Qatar\">Qatar</option><option value=\"Reunion\">Reunion</option><option value=\"Romainia\">Romainia</option><option value=\"Russia\">Russia</option><option value=\"Rwanda\">Rwanda</option><option value=\"Saint Helena\">Saint Helena</option><option value=\"Saint Kitts and Nevis\">Saint Kitts and Nevis</option><option value=\"Saint Lucia\">Saint Lucia</option><option value=\"Saint Pierre and Miquelon\">Saint Pierre and Miquelon</option><option value=\"Saint Vincent and the Grenadines\">Saint Vincent and the Grenadines</option><option value=\"Samoa\">Samoa</option><option value=\"San Marino\">San Marino</option><option value=\"Sao Tome and Principe\">Sao Tome and Principe</option><option value=\"Saudi Arabia\">Saudi Arabia</option><option value=\"Scotland\">Scotland</option><option value=\"Senegal\">Senegal</option><option value=\"Seychelles\">Seychelles</option><option value=\"Sierra Leone\">Sierra Leone</option><option value=\"Singapore\">Singapore</option><option value=\"Slovakia\">Slovakia</option><option value=\"Slovenia\">Slovenia</option><option value=\"Solomon Islands\">Solomon Islands</option><option value=\"Somalia\">Somalia</option><option value=\"South Africa\">South Africa</option><option value=\"South Georgia and South Sandwich Islands\">South Georgia and South Sandwich Islands</option><option value=\"Spain\">Spain</option><option value=\"Spratly Islands\">Spratly Islands</option><option value=\"Sri Lanka\">Sri Lanka</option><option value=\"Sudan\">Sudan</option><option value=\"Suriname\">Suriname</option><option value=\"Svalbard and Jan Mayen\">Svalbard and Jan Mayen</option><option value=\"Swaziland\">Swaziland</option><option value=\"Sweden\">Sweden</option><option value=\"Switzerland\">Switzerland</option><option value=\"Syria\">Syria</option><option value=\"Taiwan\">Taiwan</option><option value=\"Tajikistan\">Tajikistan</option><option value=\"Tanzania\">Tanzania</option><option value=\"Thailand\">Thailand</option><option value=\"Tobago\">Tobago</option><option value=\"Togo\">Togo</option><option value=\"Tokelau\">Tokelau</option><option value=\"Tonga\">Tonga</option><option value=\"Trinidad and Tobago\">Trinidad and Tobago</option><option value=\"Tunisia\">Tunisia</option><option value=\"Turkey\">Turkey</option><option value=\"Turkmenistan\">Turkmenistan</option><option value=\"Tuvalu\">Tuvalu</option><option value=\"Uganda\">Uganda</option><option value=\"Ukraine\">Ukraine</option><option value=\"United Arab Emirates\">United Arab Emirates</option><option value=\"United Kingdom\">United Kingdom</option><option value=\"United States\">United States</option><option value=\"Uruguay\">Uruguay</option><option value=\"Uzbekistan\">Uzbekistan</option><option value=\"Vanuatu\">Vanuatu</option><option value=\"Venezuela\">Venezuela</option><option value=\"Vietnam\">Vietnam</option><option value=\"Virgin Islands\">Virgin Islands</option><option value=\"Wales\">Wales</option><option value=\"Wallis and Futuna\">Wallis and Futuna</option><option value=\"West Bank\">West Bank</option><option value=\"Western Sahara\">Western Sahara</option><option value=\"Yemen\">Yemen</option><option value=\"Yugoslavia\">Yugoslavia</option><option value=\"Zambia\">Zambia</option><option value=\"Zimbabwe\">Zimbabwe</option></select>", "<select aria-hidden=\"true\" id=\"state\" name=\"state\" tabindex=\"-1\"><option disabled=\"\" hidden=\"\" selected=\"\" value=\"\">\uf74d Choose a State</option><option value=\"Alabama\">Alabama</option><option value=\"Alaska\">Alaska</option><option value=\"Arizona\">Arizona</option><option value=\"Arkansas\">Arkansas</option><option value=\"California\">California</option><option value=\"Colorado\">Colorado</option><option value=\"Connecticut\">Connecticut</option><option value=\"Delaware\">Delaware</option><option value=\"District of Columbia\">District of Columbia</option><option value=\"Florida\">Florida</option><option value=\"Georgia\">Georgia</option><option value=\"Hawaii\">Hawaii</option><option value=\"Idaho\">Idaho</option><option value=\"Illinois\">Illinois</option><option value=\"Indiana\">Indiana</option><option value=\"Iowa\">Iowa</option><option value=\"Kansas\">Kansas</option><option value=\"Kentucky\">Kentucky</option><option value=\"Louisiana\">Louisiana</option><option value=\"Maine\">Maine</option><option value=\"Maryland\">Maryland</option><option value=\"Massachusetts\">Massachusetts</option><option value=\"Michigan\">Michigan</option><option value=\"Minnesota\">Minnesota</option><option value=\"Mississippi\">Mississippi</option><option value=\"Missouri\">Missouri</option><option value=\"Montana\">Montana</option><option value=\"Nebraska\">Nebraska</option><option value=\"Nevada\">Nevada</option><option value=\"New Hampshire\">New Hampshire</option><option value=\"New Jersey\">New Jersey</option><option value=\"New Mexico\">New Mexico</option><option value=\"New York\">New York</option><option value=\"North Carolina\">North Carolina</option><option value=\"North Dakota\">North Dakota</option><option value=\"Ohio\">Ohio</option><option value=\"Oklahoma\">Oklahoma</option><option value=\"Oregon\">Oregon</option><option value=\"Pennsylvania\">Pennsylvania</option><option value=\"Rhode Island\">Rhode Island</option><option value=\"South Carolina\">South Carolina</option><option value=\"South Dakota\">South Dakota</option><option value=\"Tennessee\">Tennessee</option><option value=\"Texas\">Texas</option><option value=\"Utah\">Utah</option><option value=\"Vermont\">Vermont</option><option value=\"Virginia\">Virginia</option><option value=\"Washington\">Washington</option><option value=\"West Virginia\">West Virginia</option><option value=\"Wisconsin\">Wisconsin</option><option value=\"Wyoming\">Wyoming</option></select>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}, {"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Country, State select inputs are hidden from assistive technology with aria-hidden and tabindex=-1", "aiGenerated": null, "level": "A", "guidance": "Remove aria-hidden=\"true\" and tabindex=\"-1\" from the ''Country'' and ''State'' <select> elements so they are accessible to both assistive technology and keyboard users. Example: <label for=\"country\">Country</label>\n<select id=\"country\" name=\"country\">\n  <option></option>\n  <option value=\"Afghanistan\">Afghanistan</option>\n  <!-- Other country options -->\n</select>\n\n<label for=\"state\">State</label>\n<select id=\"state\" name=\"state\">\n  <option disabled hidden selected value=\"\">&#xf74d; Choose a State</option>\n  <option value=\"Alabama\">Alabama</option>\n  <!-- Other state options -->\n</select>", "recommendation": "Ensure the accessible country and state selection widgets are properly accessible to assistive technology or remove aria-hidden and tabindex if these are the only controls."}, {"htmlWithIssues": ["<input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/>,<input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/>,<input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/>,<input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/>", "<input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\"/>", "<input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/>,<input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/>,<input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/>", "<input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\"/>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}], "issue": "The following visually grouped radio button and checkbox groups are not grouped using <fieldset>/<legend> or ARIA group semantics: ''Party Package'', ''Are you interested in any add-on options?'', ''Are you the point of contact during the day of arrival for this group?'', and ''Add-on Options''.", "aiGenerated": null, "level": "A", "guidance": "Group related radio and checkbox inputs with <fieldset> and <legend> to define visual and semantic structure for all users, particularly with assistive technology. Example: <fieldset>\n  <legend>Party Package</legend>\n  <input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\" />\n  <label for=\"King Size\">King Size</label>\n  <input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\" />\n  <label for=\"Standard Size\">Standard Size</label>\n  <input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\" />\n  <label for=\"Snack Size\">Snack Size</label>\n  <input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\" />\n  <label for=\"Bite Size\">Bite Size</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you interested in any add-on options?</legend>\n  <input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"addonOptionYes\">Yes</label>\n  <input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"addonOptionNo\">No</label>\n</fieldset>\n\n<fieldset>\n  <legend>Add-on Options</legend>\n  <input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\" />\n  <label for=\"addonOpt1\">Food</label>\n  <input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\" />\n  <label for=\"addonOpt2\">Retail</label>\n  <input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\" />\n  <label for=\"addonOpt3\">Photos</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you the point of contact during the day of arrival for this group?</legend>\n  <input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"arrivalQuestionYes\">Yes</label>\n  <input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"arrivalQuestionNo\">No</label>\n</fieldset>", "recommendation": "Group each set of related radio buttons or checkboxes using a <fieldset> with a <legend> describing the group, or a container with role=\"group\" and aria-labelledby referencing a visible label."}, {"htmlWithIssues": ["<select aria-hidden=\"true\" id=\"country\" name=\"country\" tabindex=\"-1\"><option></option><option value=\"Afghanistan\">Afghanistan</option>...<option value=\"Zimbabwe\">Zimbabwe</option></select>", "<select aria-hidden=\"true\" id=\"state\" name=\"state\" tabindex=\"-1\"><option disabled=\"\" hidden=\"\" selected=\"\" value=\"\">\uf70d Choose a State</option><option value=\"Alabama\">Alabama</option>...<option value=\"Wyoming\">Wyoming</option></select>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}, {"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Select elements for ''Country'' and ''State'' are hidden from assistive technology using aria-hidden=\"true\" and removed from tab order with tabindex=\"-1\"", "aiGenerated": null, "level": "A", "guidance": "Remove aria-hidden=\"true\" and tabindex=\"-1\" from the select elements for ''Country'' and ''State'' to ensure that keyboard and assistive technology users can access them. Example: <label for=\"country\">Country</label>\n<select id=\"country\" name=\"country\">\n  <option></option>\n  <option value=\"Afghanistan\">Afghanistan</option>\n  <!-- Other country options -->\n</select>\n\n<label for=\"state\">State</label>\n<select id=\"state\" name=\"state\">\n  <option disabled hidden selected value=\"\">&#xf74d; Choose a State</option>\n  <option value=\"Alabama\">Alabama</option>\n  <!-- Other state options -->\n</select>", "recommendation": "Remove aria-hidden=\"true\" and tabindex=\"-1\" from the ''Country'' and ''State'' select elements so they are accessible to screen readers and keyboard users."}]}, {"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/groups.html", "formSource": "#container-9aa4afd14e form#signupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/>,<input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/>,<input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/>,<input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/>", "<input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\"/>", "<input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/>,<input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/>,<input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/>", "<input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\"/>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}], "issue": "Party Package radio button group, Add-on options radio button group, Point of contact arrival question radio button group, and Add-on Options checkbox group are not grouped using <fieldset>/<legend> or a container with role=\"group\" and aria-labelledby", "aiGenerated": null, "level": "A", "guidance": "Wrap each group of related radio and checkbox inputs in a <fieldset> with a descriptive <legend> to provide a clear relationship for assistive technologies. Example: <fieldset>\n  <legend>Party Package</legend>\n  <input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\" />\n  <label for=\"King Size\">King Size</label>\n  <input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\" />\n  <label for=\"Standard Size\">Standard Size</label>\n  <input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\" />\n  <label for=\"Snack Size\">Snack Size</label>\n  <input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\" />\n  <label for=\"Bite Size\">Bite Size</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you interested in any add-on options?</legend>\n  <input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"addonOptionYes\">Yes</label>\n  <input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"addonOptionNo\">No</label>\n</fieldset>\n\n<fieldset>\n  <legend>Add-on Options (please check all that apply):</legend>\n  <input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\" />\n  <label for=\"addonOpt1\">Food</label>\n  <input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\" />\n  <label for=\"addonOpt2\">Retail</label>\n  <input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\" />\n  <label for=\"addonOpt3\">Photos</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you the point of contact during the day of arrival for this group?</legend>\n  <input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"arrivalQuestionYes\">Yes</label>\n  <input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"arrivalQuestionNo\">No</label>\n</fieldset>", "recommendation": "Wrap all related radio buttons or checkboxes and their group label in a <fieldset> with a <legend>, or use a role=\"group\" container with aria-labelledby referencing a visible label to indicate the relationship among options."}, {"htmlWithIssues": ["<input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/>,<input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/>,<input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/>,<input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/>", "<input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\"/>", "<input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/>,<input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/>,<input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/>", "<input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\"/>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}], "issue": "Radio button groups ''Party Package'', ''Are you interested in any add-on options?'', ''Are you the point of contact during the day of arrival for this group?'' and checkbox group ''Add-on Options (please check all that apply):'' are not grouped with a fieldset/legend or ARIA group for accessible relationship", "aiGenerated": true, "level": "A", "guidance": "Wrap each group of related radio and checkbox inputs in a <fieldset> with a descriptive <legend> to ensure screen readers can announce them as groups. Example: <fieldset>\n  <legend>Party Package</legend>\n  <input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\" />\n  <label for=\"King Size\">King Size</label>\n  <input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\" />\n  <label for=\"Standard Size\">Standard Size</label>\n  <input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\" />\n  <label for=\"Snack Size\">Snack Size</label>\n  <input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\" />\n  <label for=\"Bite Size\">Bite Size</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you interested in any add-on options?</legend>\n  <input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"addonOptionYes\">Yes</label>\n  <input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"addonOptionNo\">No</label>\n</fieldset>\n\n<fieldset>\n  <legend>Add-on Options (please check all that apply):</legend>\n  <input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\" />\n  <label for=\"addonOpt1\">Food</label>\n  <input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\" />\n  <label for=\"addonOpt2\">Retail</label>\n  <input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\" />\n  <label for=\"addonOpt3\">Photos</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you the point of contact during the day of arrival for this group?</legend>\n  <input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"arrivalQuestionYes\">Yes</label>\n  <input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"arrivalQuestionNo\">No</label>\n</fieldset>", "recommendation": "Group all radio button and checkbox groups inside a <fieldset> with a <legend> or inside an element with role=\"group\" and aria-labelledby referencing a visible label to ensure an accessible relationship."}]}, {"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/private-events-and-meetings.html", "formSource": "#container-73717d1017 form#signupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/>,<input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/>,<input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/>,<input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/>", "<input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\"/>", "<input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/>,<input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/>,<input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/>", "<input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\"/>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}], "issue": "Visually grouped radio buttons for ''Party Package'', ''Are you interested in any add-on options?'', ''Are you the point of contact during the day of arrival for this group?'' and checkboxes for ''Add-on Options'' are not programmatically grouped using <fieldset>/<legend> or role=''group''/aria-labelledby", "aiGenerated": null, "level": "A", "guidance": "Wrap each group of related radio and checkbox inputs in a <fieldset> with a descriptive <legend> to provide correct programmatic grouping and ensure assistive technologies communicate group context. Example: <fieldset>\n  <legend>Party Package</legend>\n  <input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\" />\n  <label for=\"King Size\">King Size</label>\n  <input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\" />\n  <label for=\"Standard Size\">Standard Size</label>\n  <input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\" />\n  <label for=\"Snack Size\">Snack Size</label>\n  <input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\" />\n  <label for=\"Bite Size\">Bite Size</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you interested in any add-on options?</legend>\n  <input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"addonOptionYes\">Yes</label>\n  <input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"addonOptionNo\">No</label>\n</fieldset>\n\n<fieldset>\n  <legend>Add-on Options (please check all that apply):</legend>\n  <input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\" />\n  <label for=\"addonOpt1\">Food</label>\n  <input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\" />\n  <label for=\"addonOpt2\">Retail</label>\n  <input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\" />\n  <label for=\"addonOpt3\">Photos</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you the point of contact during the day of arrival for this group?</legend>\n  <input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"arrivalQuestionYes\">Yes</label>\n  <input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"arrivalQuestionNo\">No</label>\n</fieldset>", "recommendation": "Group all related radio buttons or checkboxes inside a <fieldset> with a <legend> or a div with role=''group'' and aria-labelledby corresponding to their question."}, {"htmlWithIssues": ["<input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/>,<input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/>,<input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/>,<input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/>", "<input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\"/>", "<input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/>,<input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/>,<input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/>", "<input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\"/>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}, {"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Radio button groups ''Party Package'', ''Are you interested in any add-on options?'', ''Are you the point of contact during the day of arrival for this group?'' and checkbox group ''Add-on Options (please check all that apply):'' are not grouped with a fieldset/legend or correct ARIA role/group, which can make group context inaccessible", "aiGenerated": true, "level": "A", "guidance": "Wrap all related radio and checkbox input groups in a <fieldset> with a proper <legend> to provide accessible, semantic structure and correct group context for users of assistive technology. Example: <fieldset>\n  <legend>Party Package</legend>\n  <input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\" />\n  <label for=\"King Size\">King Size</label>\n  <input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\" />\n  <label for=\"Standard Size\">Standard Size</label>\n  <input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\" />\n  <label for=\"Snack Size\">Snack Size</label>\n  <input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\" />\n  <label for=\"Bite Size\">Bite Size</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you interested in any add-on options?</legend>\n  <input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"addonOptionYes\">Yes</label>\n  <input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"addonOptionNo\">No</label>\n</fieldset>\n\n<fieldset>\n  <legend>Add-on Options (please check all that apply):</legend>\n  <input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\" />\n  <label for=\"addonOpt1\">Food</label>\n  <input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\" />\n  <label for=\"addonOpt2\">Retail</label>\n  <input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\" />\n  <label for=\"addonOpt3\">Photos</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you the point of contact during the day of arrival for this group?</legend>\n  <input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"arrivalQuestionYes\">Yes</label>\n  <input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"arrivalQuestionNo\">No</label>\n</fieldset>", "recommendation": "Wrap all related radio and checkbox input groups in a <fieldset> with a <legend>, or use a container with role=\"group\" and aria-labelledby referencing a visible group label, to provide proper accessible relationships."}]}, {"form": "https://www.tenant-alpha-secondary.com/things-to-do/events/pokemon-go.html", "formSource": "#container-ddcd3e707b form#signupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/>,<input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/>,<input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/>,<input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/>", "<input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\"/>", "<input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/>,<input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/>,<input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/>", "<input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\"/>,<input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\"/>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}], "issue": "Visually grouped radio buttons and checkboxes for ''Party Package'', ''Are you interested in any add-on options?'', ''Are you the point of contact during the day of arrival for this group?'', and ''Add-on Options'' are not programmatically grouped using <fieldset>/<legend> or role=''group''/aria-labelledby", "aiGenerated": null, "level": "A", "guidance": "Wrap each visually grouped set of radio buttons and checkboxes in a <fieldset> with a descriptive <legend> to communicate the group relationship to assistive technology. Example: <fieldset>\n  <legend>Party Package</legend>\n  <input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\" />\n  <label for=\"King Size\">King Size</label>\n  <input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\" />\n  <label for=\"Standard Size\">Standard Size</label>\n  <input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\" />\n  <label for=\"Snack Size\">Snack Size</label>\n  <input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\" />\n  <label for=\"Bite Size\">Bite Size</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you interested in any add-on options?</legend>\n  <input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"addonOptionYes\">Yes</label>\n  <input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"addonOptionNo\">No</label>\n</fieldset>\n\n<fieldset>\n  <legend>Add-on Options</legend>\n  <input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\" />\n  <label for=\"addonOpt1\">Food</label>\n  <input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\" />\n  <label for=\"addonOpt2\">Retail</label>\n  <input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\" />\n  <label for=\"addonOpt3\">Photos</label>\n</fieldset>\n\n<fieldset>\n  <legend>Are you the point of contact during the day of arrival for this group?</legend>\n  <input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\" />\n  <label for=\"arrivalQuestionYes\">Yes</label>\n  <input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\" />\n  <label for=\"arrivalQuestionNo\">No</label>\n</fieldset>", "recommendation": "Group all visually grouped radio buttons and checkboxes inside a <fieldset> with a <legend> or a div with role=''group'' and aria-labelledby."}, {"htmlWithIssues": ["<input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/><label for=\"King Size\">King Size</label>,<input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/><label for=\"Standard Size\">Standard Size</label>,<input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/><label for=\"Snack Size\">Snack Size</label>,<input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/><label for=\"Bite Size\">Bite Size</label>", "<input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/><label for=\"addonOpt1\">Food </label>,<input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/><label for=\"addonOpt2\">Retail </label>,<input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/><label for=\"addonOpt3\">Photos </label>"], "successCriterias": [{"name": "Info and Relationships", "criteriaNumber": "1.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"}, {"name": "Labels or Instructions", "criteriaNumber": "3.3.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html"}], "issue": "Party Package radio buttons, Add-on Options checkboxes are not grouped within a fieldset/legend or ARIA group with an accessible label", "aiGenerated": true, "level": "A", "guidance": "Group each set of related radio buttons and checkboxes in a <fieldset> with a relevant <legend> so screen readers recognize the group purpose. Example: <fieldset>\n  <legend>Party Package</legend>\n  <input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\" />\n  <label for=\"King Size\">King Size</label>\n  <input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\" />\n  <label for=\"Standard Size\">Standard Size</label>\n  <input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\" />\n  <label for=\"Snack Size\">Snack Size</label>\n  <input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\" />\n  <label for=\"Bite Size\">Bite Size</label>\n</fieldset>\n\n<fieldset>\n  <legend>Add-on Options</legend>\n  <input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\" />\n  <label for=\"addonOpt1\">Food</label>\n  <input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\" />\n  <label for=\"addonOpt2\">Retail</label>\n  <input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\" />\n  <label for=\"addonOpt3\">Photos</label>\n</fieldset>", "recommendation": "Group related radio buttons and checkboxes using a <fieldset> and <legend> or a role=''group'' container with aria-labelledby referencing a visible group label."}]}]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form accessibility report',
    NULL,
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Accessibility']::text[],
    '2025-08-03T06:37:12.103Z'::timestamptz,
    '2025-08-10T06:37:30.582Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'b4443ff6-bad8-4898-89d0-cf1413b05980',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '9a5486ec-9de0-449b-9f06-252a47d745f2',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/Ebpoflp2gHFNl4w5-9C7dFEBBHHE4gTaRzHaofqSxJMuuQ?e=Ss6mep',
    'form-accessibility',
    '{"accessibility": [{"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#birthday-form form#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\"", "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Form elements must have labels", "level": "A"}]}]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form accessibility report',
    NULL,
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Accessibility']::text[],
    '2025-07-27T07:05:37.771Z'::timestamptz,
    '2025-08-10T06:37:30.583Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'ab39c6a0-d08c-469b-adfc-2055239c478f',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '71766369-1992-4d77-a887-5d8e5bf72e47',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/Ebpoflp2gHFNl4w5-9C7dFEBBHHE4gTaRzHaofqSxJMuuQ?e=Ss6mep',
    'form-accessibility',
    '{"accessibility": [{"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#birthday-form form#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\"", "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Form elements must have labels", "level": "A", "guidance": "Adding explicit <label> elements for each input provides a programmatically associated label, improving accessibility; for example: <label for=\"adults\">Number of Adults</label><input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\"> <label for=\"youth\">Number of Youth</label><input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\"> <label for=\"toddlers\">Number of Toddlers</label><input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"}]}]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form accessibility report',
    NULL,
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Accessibility']::text[],
    '2025-08-10T06:37:30.612Z'::timestamptz,
    '2025-08-14T12:03:18.972Z'::timestamptz,
    '56DC208767F638210A495FB0@7eeb20f8631c0cb7495c06.e'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'd8c8177c-7a36-4dd5-ab9b-910d2f1ee3e5',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '0092aa47-7725-49ef-9583-e5670585bd28',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/Ebpoflp2gHFNl4w5-9C7dFEBBHHE4gTaRzHaofqSxJMuuQ?e=Ss6mep',
    'form-accessibility',
    '{"accessibility": [{"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#birthday-form form#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\"", "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Form elements must have labels", "level": "A", "guidance": "Each input field is explicitly associated with a visible <label> to provide an accessible name, satisfying WCAG 2.2 SC 4.1.2 requirements. \n<label for=\"adults\">Number of adults:</label>\n<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">\n\n<label for=\"youth\">Number of youth:</label>\n<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">\n\n<label for=\"toddlers\">Number of toddlers:</label>\n<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"}]}]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form accessibility report',
    NULL,
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Accessibility']::text[],
    '2025-08-17T06:22:17.120Z'::timestamptz,
    '2025-08-18T11:30:57.446Z'::timestamptz,
    '56DC208767F638210A495FB0@7eeb20f8631c0cb7495c06.e'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '5c2b8099-a502-474d-835f-2699fc037cd3',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'ff571653-f002-40cf-8661-511045de6439',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/Ebpoflp2gHFNl4w5-9C7dFEBBHHE4gTaRzHaofqSxJMuuQ?e=Ss6mep',
    'form-accessibility',
    '{"accessibility": [{"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#birthday-form form#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\"", "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Form elements must have labels", "level": "A", "guidance": "Associating each input with a properly linked <label> provides accessible names for screen readers and users. <label for=\"adults\">Number of adults</label> <input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\"> <label for=\"youth\">Number of youth</label> <input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\"> <label for=\"toddlers\">Number of toddlers</label> <input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"}]}]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form accessibility report',
    NULL,
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Accessibility']::text[],
    '2025-08-23T02:24:51.730Z'::timestamptz,
    '2025-08-24T06:21:21.750Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '8de79706-8e42-4a63-8d11-7240a51ad733',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '8b2136c3-8609-4e5c-94be-a73fd3354dc4',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/Ebpoflp2gHFNl4w5-9C7dFEBBHHE4gTaRzHaofqSxJMuuQ?e=Ss6mep',
    'form-accessibility',
    '{"accessibility": [{"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#birthday-form form#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\"", "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Form elements must have labels", "level": "A", "guidance": "Adding explicit <label> elements with proper ''for'' attributes gives each input an accessible name so screen readers can identify their purpose. For example: <label for=\"adults\">Number of adults</label><input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\"> <label for=\"youth\">Number of youth</label><input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\"> <label for=\"toddlers\">Number of toddlers</label><input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"}]}]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form accessibility report',
    NULL,
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Accessibility']::text[],
    '2025-08-24T06:21:21.759Z'::timestamptz,
    '2025-08-31T06:21:21.666Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'b7966bd5-1b6a-48ba-b50d-8336d5f7c901',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'e750bff3-ebdc-48cb-9862-c1cf2d9e1207',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/Ebpoflp2gHFNl4w5-9C7dFEBBHHE4gTaRzHaofqSxJMuuQ?e=Ss6mep',
    'form-accessibility',
    '{"accessibility": [{"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#birthday-form form#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\"", "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Form elements must have labels", "level": "A", "guidance": "Add explicit <label> elements linked via the ''for'' attribute to ensure each input is properly labeled for screen readers. Example:\n<label for=\"adults\">Number of Adults</label>\n<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">\n<label for=\"youth\">Number of Youth</label>\n<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">\n<label for=\"toddlers\">Number of Toddlers</label>\n<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"}]}]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form accessibility report',
    NULL,
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Accessibility']::text[],
    '2025-08-31T06:21:21.676Z'::timestamptz,
    '2025-09-03T06:50:55.581Z'::timestamptz,
    '56DC208767F638210A495FB0@7eeb20f8631c0cb7495c06.e'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'acaa08cd-756b-49d8-b0eb-314af9e4bd69',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'bed1f8a8-7ca5-4438-8b6a-5bf410628018',
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Accessibility report - Desktop - Week 32 - 2025',
    'A web accessibility audit is an assessment of how well your website and digital assets conform to the needs of people with disabilities and if they follow the Web Content Accessibility Guidelines (WCAG). Desktop only.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-08-07T12:56:43.439Z'::timestamptz,
    '2025-09-29T07:27:12.456Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '41b3a888-5b76-48cd-a88a-86c49351f7ec',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '97778cfc-c014-4393-a5a4-b8cdceb4bb80',
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Accessibility report - Desktop - Week 40 - 2025 - in-depth',
    'This report provides an in-depth overview of various accessibility issues identified across different web pages. It categorizes issues based on their severity and impact, offering detailed descriptions and recommended fixes. The report covers critical aspects such as ARIA attributes, keyboard navigation, and screen reader compatibility to ensure a more inclusive and accessible web experience for all users.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-09-29T07:27:12.480Z'::timestamptz,
    '2025-09-29T07:27:12.504Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '8e81a10a-4fff-485b-a7d7-d06b737d032e',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '97778cfc-c014-4393-a5a4-b8cdceb4bb80',
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Enhancing accessibility for the top 10 most-visited pages - Desktop - Week 40 - 2025',
    'Here are some optimization suggestions that could help solve the accessibility issues found on the top 10 most-visited pages.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-09-29T07:27:12.515Z'::timestamptz,
    '2025-09-29T07:27:12.541Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'e7fbbb89-44aa-4e3b-99cc-c0892f839b02',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '97778cfc-c014-4393-a5a4-b8cdceb4bb80',
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Accessibility report - Desktop - Week 40 - 2025',
    'A web accessibility audit is an assessment of how well your website and digital assets conform to the needs of people with disabilities and if they follow the Web Content Accessibility Guidelines (WCAG). Desktop only.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-09-29T07:27:12.551Z'::timestamptz,
    '2025-10-06T07:24:33.505Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '3f075fd4-80aa-4af4-b2e7-0e71098674fd',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '1758c317-94a0-45d5-87f8-28baeba4973e',
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Accessibility report - Desktop - Week 41 - 2025 - in-depth',
    'This report provides an in-depth overview of various accessibility issues identified across different web pages. It categorizes issues based on their severity and impact, offering detailed descriptions and recommended fixes. The report covers critical aspects such as ARIA attributes, keyboard navigation, and screen reader compatibility to ensure a more inclusive and accessible web experience for all users.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-10-06T07:24:33.545Z'::timestamptz,
    '2025-10-06T07:24:33.569Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'a20384e3-9509-4b54-9c9c-5e5dce9bb97c',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '1758c317-94a0-45d5-87f8-28baeba4973e',
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Enhancing accessibility for the top 10 most-visited pages - Desktop - Week 41 - 2025',
    'Here are some optimization suggestions that could help solve the accessibility issues found on the top 10 most-visited pages.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-10-06T07:24:33.580Z'::timestamptz,
    '2025-10-06T07:24:33.607Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '2d0b5ddc-c505-4b7b-8666-bcd386242a66',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '1758c317-94a0-45d5-87f8-28baeba4973e',
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/Shared%20Documents/3%20-%20Experience%20Success/SpaceCat/Runbooks/Experience_Success_Studio_Runbook_Template.docx?d=w5ec0880fdc7a41c786c7409157f5de48&csf=1&web=1&e=vXnRVq',
    'generic-opportunity',
    NULL::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Accessibility report Fixed vs New Issues - Desktop - Week 41 - 2025',
    'This report provides a comprehensive analysis of accessibility issues, highlighting both resolved and newly identified problems. It aims to track progress in improving accessibility and identify areas requiring further attention.',
    'IGNORED'::opportunity_status,
    NULL::jsonb,
    ARRAY['a11y']::text[],
    '2025-10-06T07:24:33.617Z'::timestamptz,
    '2025-10-06T07:24:33.638Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '965b9ccc-9dc2-4125-a0dc-26d3124a803d',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/EU_cqrV92jNIlz8q9gxGaOMBSRbcwT9FPpQX84bRKQ9Phw?e=Nw9ZRz',
    'high-form-views-low-conversions',
    '{"formViews": 16600, "trackedFormKPIName": "Conversion Rate", "form": "https://www.tenant-alpha-secondary.com/", "trackedFormKPIValue": 0.006024096385542169, "pageViews": 16600, "screenshot": null, "metrics": [{"type": "conversionRate", "value": {"page": 0.006024096385542169}, "vendor": "*"}], "samples": 16600}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form has high views but low conversions',
    'Form has high views but low conversions',
    'NEW'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Conversion']::text[],
    '2025-02-02T05:50:26.576Z'::timestamptz,
    '2025-02-23T06:13:43.650Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'af89efda-cb7d-4cf9-9740-f21196f337a5',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '7c4f1cb7-8bc4-4b3e-ab90-3d6676ef7491',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/ETCwSsZJzRJIuPqnC_jZFhgBsW29GijIgk9C6-GpkQ16xg?e=dNYZhD',
    'high-page-views-low-form-nav',
    '{"formViews": 200, "scrapedStatus": false, "trackedFormKPIName": "Form Views", "formsource": "#newsletter_section1 form.newsletter-form", "trackedFormKPIValue": 200, "form": "https://www.tenant-alpha-secondary.com/home/subscribe.html", "pageViews": 200, "formNavigation": {"url": "https://www.tenant-alpha-secondary.com/locations/las-vegas.html", "source": null}, "metrics": [{"type": "formViews", "device": "*", "value": {"page": 200}}, {"type": "formViews", "device": "mobile", "value": {"page": 200}}, {"type": "formViews", "device": "desktop", "value": {"page": 0}}, {"type": "traffic", "device": "*", "value": {"paid": null, "total": null, "earned": null, "owned": null}}], "screenshot": "https://spacecat-prod-scraper.s3.us-east-1.amazonaws.com/scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/home/subscribe.html/forms/screenshot-desktop-fullpage.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIAZKDIC5H2NNQSAQ3H%2F20250507%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250507T152133Z&X-Amz-Expires=604800&X-Amz-Security-Token=IQoJb3JpZ2luX2VjELj%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJIMEYCIQCp1px56AORvrS7OICnf6iBRxMKBLChuGyY2JxcnPmwhQIhAJ2nfcc611PM%2F5%2BuDsqHKRnO1obWEwxBqKe8y40Oac9yKpMDCGAQABoMNjQwMTY4NDIxODc2IgzGBLRivwSxVxyq%2Fvgq8ALqAOEaCTiEYG%2FSdfT0uhnR67DyKTLZUFofeVaGCSEj07HSj1xIeJW1KDFvnpkAAmWOw3WO%2FTXdLImF4vuxqss2KG%2BNJ0vUBsA%2BJnrBngY7jy41vPYpET8sFCDCPHLWPIxtobJSBRuQoK%2BSqBWjaFNeOmYBOf91zDWmXRQQKj2FM5j7QyYTpSuMzrlk3wYUk%2B7f1GJgqIEd2P3uFBqLK1XQN9zstP9tKFfTuh069JUFQx5B8YQl7Mu2O7WLNLu6FVF2fTEN%2FWCjZygwWWcYguEopsBefzvIQGeMXC%2B%2BzmtAIGp8988mAcFDLLGHyFQ%2BxSCx0e1UvrXzdVNW1AJfquXj9hm%2BM4QQ021ETGfZH8JWEyxxgSAjTo4dUgiX2so3HKcEduoT%2FJxXOj%2FwokPKLZlSNtCOthqdflIAEZc5LvQSISefaMwyBQs0I%2FDbnkeNU3Jv4TlVerq3MstLRsjh3o4SxaZ6yLMIs4vrdfkdl9xoTzDt9O3ABjqcATS%2BLVDqTJy2DlMGlvLoTJWrdyBmtcNs43OdEpLZf%2BAFNkJkPs%2FNovueQ8WXBpYBkaUYQg2v0%2Bfm9ciSr5x8NQCdgTEVWNmh4LLlumF0efMXwLxTQFvxd3CMuS2%2BaSuHZyMUaDWP9%2BabFnXnUuNeRsvCOFZE6Wi%2BQSfDE5KvsZBuPlJue6OZ0XN06tCy8ms7o6OreYbhMxCuT2AgfA%3D%3D&X-Amz-Signature=1a79af98703e4dcf6551eaf75176403b98a7235ec9705f262cabd1e636d72619&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject", "dataSources": ["RUM", "Page"], "samples": 200}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form has low views',
    'The form has low views due to low navigations in the page containing its CTA',
    'NEW'::opportunity_status,
    '{"recommendations": [{"insight": "The CTA element in the page: https://www.tenant-alpha-secondary.com/locations/las-vegas.html is not placed in the most optimal positions for visibility and engagement", "recommendation": "Reposition the CTA to be more centrally located and ensure they are above the fold.", "type": "guidance", "rationale": "CTAs placed above the fold and in central positions are more likely to be seen and clicked by users, leading to higher engagement rates."}]}'::jsonb,
    ARRAY['Forms Conversion']::text[],
    '2025-05-07T15:21:33.476Z'::timestamptz,
    '2025-05-07T15:21:33.476Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'e1671987-541a-4b6c-945d-11026ffb54b0',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'addcb4bc-e347-43e3-87a2-34cddf52855b',
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/_layouts/15/Doc.aspx?sourcedoc=%7B19613D9B-93D4-4112-B7C8-DBE0D9DCC55B%7D&file=Experience_Success_Studio_High_Organic_Traffic_Low_CTR_Runbook.docx&action=default&mobileredirect=true',
    'high-organic-low-ctr',
    '{"pageViews": 7000, "trackedPageKPIName": "Click Through Rate", "trackedPageKPIValue": 0.5857142857142857, "opportunityImpact": 63.66564664197127, "trackedKPISiteAverage": 0.649379932356257, "page": "https://www.tenant-alpha-secondary.com/things-to-do/tenant-alpha-trolley-works.html", "metrics": [{"type": "traffic", "value": {"paid": 0, "total": 7000, "earned": 1000, "owned": 6000}, "vendor": "*"}, {"type": "ctr", "value": {"page": 0.5857142857142857}, "vendor": "*"}, {"type": "pageOnTime", "value": {"time": 6700}, "vendor": "*"}, {"type": "traffic", "value": {"paid": 0, "total": 200, "earned": 200, "owned": 0}, "vendor": "google"}, {"type": "ctr", "value": {"page": 1}, "vendor": "google"}, {"type": "pageOnTime", "value": {"time": 6700}, "vendor": "google"}], "dataSources": ["Site", "RUM", "Ahrefs"], "samples": 7000}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Page with high organic traffic but low click through rate detected',
    'Adjusting the wording, images and/or layout on the page to resonate more with a specific audience should increase the overall engagement on the page and ultimately bump conversion.',
    'NEW'::opportunity_status,
    '{"recommendations": [{"brief": "Incorporate high-intent keywords and ticket-booking signals into both H1 and CTA to directly match user search behavior and maximize conversion\u2014these concise changes resolve intent ambiguity and create a frictionless path to purchase.", "insight": "Organic Search Keywords: tenant-alpha trolley works tickets, tenant-alpha trolley works, tenant-alpha trolley, tenant-alpha trolley works tours, tenant-alpha trolley tour, tenant-alpha trolley schedule, historical trolley tour, tenant-alpha park trolley, holly jolly trolley tenant-alpha, sweet lights trolley tenant-alpha\nPage Intent: Conversion page\u2014primary goal is to prompt visitors to purchase tickets for Tenant Alpha Trolley Works tours.\nPage Type: Product/Service Page (dedicated to promoting and selling the Trolley Works attraction, listing tour options, prices, and conversion actions).\nWebsite Type: Entertainment/Event Attraction Website (Tenant Alpha\u2019s Chocolate World \u2014 a physical-location, ticketed attraction site).\nIndustry Type: Travel, Hospitality & Tourism", "recommendation": "H1 Before: Tenant Alpha Trolley Works\nH1 After: Tenant Alpha Trolley Works Tickets & Tours\nCTA Before: Buy Tickets\nCTA After: Buy Tickets for Tenant Alpha Trolley Works", "type": "guidance", "rationale": "The current H1 (''Tenant Alpha Trolley Works'', 21 characters/3 words) is strong on branding but misses a vital opportunity to capture organic searchers at a key decision point\u2014those looking to learn about, and immediately purchase, trolley tour tickets (the highest-value search and conversion terms). By updating the H1 to ''Tenant Alpha Trolley Works Tickets & Tours'' (37 characters/6 words), we insert both ''tickets'' and ''tours'', echoing exact-match high-intent keywords and making the conversion purpose of the page instantly clear in both SERPs and on-page. This minor length increase does not challenge readability and aligns well with travel/tourism norms (where longer, descriptive H1s convert at higher rates for attraction detail pages).\n\nThe CTA ''Buy Tickets'' (10 characters/2 words) is direct but generic\u2014given multiple attractions onsite, specifying ''for Tenant Alpha Trolley Works'' (31 characters/5 words) removes any ambiguity, boosts user confidence that they''re completing the right transaction, and leverages critical organic keyword phrases (especially ''tenant-alpha trolley works tickets'') for last-mile conversion. Despite a character increase, the new CTA remains concise, actionable, and mobile-friendly. This specificity is proven in UX research to improve CTR on multi-attraction or ticket-based event sites.\n\nBoth changes maintain brand consistency (confident, clear, family-focused), directly answer user needs, and are supported by both industry best practice and insights from your organic query data. This targeted, keyword-aligned messaging ensures users feel understood and guided, driving more clicks and bookings\u2014a critical lift for this core conversion page."}]}'::jsonb,
    ARRAY['Engagement']::text[],
    '2025-06-21T11:40:01.667Z'::timestamptz,
    '2025-07-31T11:25:41.495Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'f2dada9a-d4b7-4f16-a52f-fd51f8b9db32',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'addcb4bc-e347-43e3-87a2-34cddf52855b',
    'https://adobe.sharepoint.com/:w:/r/sites/aemsites-engineering/_layouts/15/Doc.aspx?sourcedoc=%7B19613D9B-93D4-4112-B7C8-DBE0D9DCC55B%7D&file=Experience_Success_Studio_High_Organic_Traffic_Low_CTR_Runbook.docx&action=default&mobileredirect=true',
    'high-organic-low-ctr',
    '{"pageViews": 5500, "trackedPageKPIName": "Click Through Rate", "trackedPageKPIValue": 0.6545454545454545, "opportunityImpact": 0, "trackedKPISiteAverage": 0.649379932356257, "page": "https://www.tenant-alpha-secondary.com/things-to-do/reeses-stuff-your-cup.html", "metrics": [{"type": "traffic", "value": {"paid": 0, "total": 5500, "earned": 2000, "owned": 3500}, "vendor": "*"}, {"type": "ctr", "value": {"page": 0.6545454545454545}, "vendor": "*"}, {"type": "pageOnTime", "value": {"time": 722}, "vendor": "*"}, {"type": "traffic", "value": {"paid": 0, "total": 1400, "earned": 1400, "owned": 0}, "vendor": "google"}, {"type": "ctr", "value": {"page": 0.8571428571428571}, "vendor": "google"}, {"type": "pageOnTime", "value": {"time": 722}, "vendor": "google"}], "dataSources": ["Site", "RUM", "Ahrefs"], "samples": 5500}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Page with high organic traffic but low click through rate detected',
    'Adjusting the wording, images and/or layout on the page to resonate more with a specific audience should increase the overall engagement on the page and ultimately bump conversion.',
    'NEW'::opportunity_status,
    '{"recommendations": [{"brief": null, "insight": "Organic Search Keywords: [reese''s stuff your cup, build your own reese''s cup, make your own reese''s cup, reese''s stuff your cup locations, reese''s stuff your cup nyc, giant reese''s cup, custom reese''s]\nPage Intent: Conversion (drive bookings or ticket purchases for the experience)\nPage Type: Product/Service Experience Page\nWebsite Type: Attraction/Experience Center\nIndustry Type: Travel, Hospitality & Tourism", "recommendation": "H1 Before: REESE''S Stuff Your Cup\nH1 After: Make Your Own Giant REESE''S Stuff Your Cup\nCTA Before: Buy Tickets\nCTA After: Get Started", "type": "guidance", "rationale": "The core opportunity for CTR and conversion improvement comes from tightly aligning the above-the-fold H1 and CTA with both actual user search behaviors and high-intent queries. Current H1 (''REESE''S Stuff Your Cup'') establishes the brand/experience but does not utilize leading-keyword phrases like ''make your own'', ''giant'', or ''build your own'', all of which have significant search volume and better match user expectations. Explicitly referencing the unique aspect (a one-pound or giant cup) attracts curiosity and signals a special, memorable experience, boosting organic CTR and relevancy. For the CTA, ''Buy Tickets'' matches intent but is generic; ''Get Started'' acts as an inviting, action-oriented gateway into the custom experience funnel and is equally brief, ensuring minimal friction and high engagement. Both recommendations keep within similar character/word limits (H1: +21 characters, CTA: same word count), remain on-brand and conversion-oriented, and are free of buzzwords or inconsistent tone."}]}'::jsonb,
    ARRAY['Engagement']::text[],
    '2025-06-21T11:06:29.172Z'::timestamptz,
    '2025-07-31T11:26:38.752Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    'eca3d63f-6780-442f-99a6-7f9fcb750663',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    '8b2136c3-8609-4e5c-94be-a73fd3354dc4',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/EeYKNa4HQkRAleWXjC5YZbMBMhveB08F1yTTUQSrP97Eow?e=cZdsnA',
    'high-page-views-low-form-views',
    '{"scrapedStatus": false, "trackedFormKPIName": "Form View Rate", "screenshot": "https://spacecat-prod-scraper.s3.us-east-1.amazonaws.com/scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/tickets.html/forms/screenshot-desktop-fullpage.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIAZKDIC5H2OIBKXYWN%2F20250824%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250824T062121Z&X-Amz-Expires=604800&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEOf%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJIMEYCIQCN7Od%2Fo5uT8u0UcxwpdnV%2BpDY5eC5JeAV2OXZve4WoHwIhAP%2FwaIBbyfNknSDybHO9EZYVdmWqKdH%2BTAJtd6dHIWQUKpMDCD8QABoMNjQwMTY4NDIxODc2IgwDm%2BZ1qi1o4gopg90q8AJbBMdfX2u21Wif7YhApmOoVIAI%2Fn1uhg5BlBoKwAm5UGmJ68O9irCGGQuhlUQuhljjbH1hq2DMU3lWFAdsIy%2BsFkNXJKGoLtIfMvL4R4sMYxhZUo6pOBaFaUnfSRGEH5UCTfgmcIutwtpmfk4Lwqpwkn5pldFMLaLZ3dh94TWzLQQ9ALbyTlkefB7nGqzoZxkpLjI42Zy33inXl9tqnphDX2k2WHQdoUIC7E7rVaf5MLJCpoD%2FdQwXylppFKC8XICvIsFcgpJGDX86Z0403cxdshL7PL%2BpqQWB2UptQ25bJvCOvkSH%2BuNnqZDjkTj4%2FGwuYulpgFF5GQbtwl6ESc9WrNemndmmr7Kn%2BwRMsbyg9myVwpvQ54f33W7%2Bq4vXNFD9Xy%2Bi46%2BoCoyxEAPpm9mDQup00OxtdVpQx8paCYTDajlZpE3HuZlyjJhOWk8FZQZh7g6ACdRALNFW3lm4w23WqI3mbF%2FsJpr732DltpitWzC116rFBjqcASWev3%2B5curIM6WbftJE1CHAeXXJy9%2Bw70OfCar3FShp%2FldSiji%2BN1%2BXhgOFIdL%2BFklBBP6IhIp7Zr3fYtNecq4o3t0l5pa0vCwhgYZkM3HvbraAOUQA9uS%2F4niba20n5QZHscsySHFkRmJSzoJCuyrlhQH%2Fp%2FZFF9ond74x0Jf8Hg2gTVnSNUHqewQe42ipZXn%2BpkhI558QUqYV7g%3D%3D&X-Amz-Signature=0f993490a701a0e3d0357588b1f1acc8839011b1f507244c5be81d5dd899d2e2&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject", "projectedConversionValue": 67344.99, "samples": 54100, "formViews": 3700, "formsource": "#container-fc43a3d30a form#signupForm", "trackedFormKPIValue": 0.068, "form": "https://www.tenant-alpha-secondary.com/tickets.html", "pageViews": 54100, "metrics": [{"type": "formViewRate", "device": "*", "value": {"page": 0.068}}, {"type": "formViewRate", "device": "mobile", "value": {"page": 0.062}}, {"type": "formViewRate", "device": "desktop", "value": {"page": 0.097}}, {"type": "traffic", "device": "desktop", "value": {"page": 10300}}, {"type": "traffic", "device": "mobile", "value": {"page": 43800}}], "formDetails": {"is_lead_gen": false, "industry": "Consumer Products", "form_type": "Order Form", "form_category": "B2C", "cpl": 93.08}, "dataSources": ["RUM", "Page"]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form has low views',
    'The form has low views but the page containing the form has higher traffic',
    'NEW'::opportunity_status,
    '{"recommendations": [{"brief": null, "insight": "The email signup form (''Let''s keep in touch'') is currently buried at the bottom of a long, conversion-focused ticket and product page, making it difficult for visitors to notice or reach, especially after scrolling through numerous attractions, bundles, and purchasing CTAs.", "recommendation": "Move or duplicate the ''Let''s keep in touch'' email form and CTA section higher on the page\u2013for example, directly beneath primary ticket bundle details or above the FAQ section. Use the same maroon background and concise design to ensure visual consistency, but place it where user attention is highest. A practical implementation: After the main ''Buy Tickets'' CTA and ticket bundles (above the FAQs), insert the email signup form with header ''Let''s keep in touch'', input for ''Your email address'', and the white ''Submit Email'' button.", "type": "guidance", "rationale": "Most users are unlikely to scroll to the page footer, particularly on a conversion-centric page filled with persuasive product and ticket purchase prompts. This deep placement minimizes the chance the form is seen or engaged with, directly contributing to low view metrics."}, {"brief": null, "insight": "The only call-to-action for email sign-up is the in-form ''Submit Email'' button, with no external links, banners, or navigation prompts inviting users to sign up or linking to the form elsewhere on the page.", "recommendation": "Add a visually engaging CTA for newsletter sign-up in the site header or as a floating element, such as a sticky banner: ''Get Sweet Updates \u2013 Sign up for exclusive offers!'' Link this directly to the email signup form. Example: A small floating bar at the bottom of the screen on mobile and desktop, labeled ''Get Sweet Updates'' with a direct field for email entry or a button leading users to the form.", "type": "guidance", "rationale": "Without supporting cross-page CTAs or sign-up invitations in main navigation, sticky headers, or throughout content, most users will not know about the newsletter offer until the very end, missing opportunities to convert earlier. The lack of interconnected CTAs further isolates the form and reduces engagement."}, {"brief": null, "insight": "The form is notably absent or hidden in desktop screenshots, suggesting it may only load in certain contexts or be dependent on user interaction (e.g., modal, popup, or dynamic load).", "recommendation": "Ensure the email signup form is always visible in the main page content on both desktop and mobile, without relying on pop-up triggers or dynamic loading. Immediate visibility addresses desktop discovery issues. For example: Insert the ''Let''s keep in touch'' section in the visible content area (not inside modal or hidden elements) right after major conversion CTAs.", "type": "guidance", "rationale": "If the form is not reliably present on desktop or is hidden until triggered, a large portion of visitors will never discover it. Consistency across devices is critical for capturing more signups and maximizing reach."}]}'::jsonb,
    ARRAY['Form Placement']::text[],
    '2025-08-23T02:24:51.336Z'::timestamptz,
    '2025-08-24T09:08:51.062Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '88ced17c-1577-43bd-a8d2-3e41cdd6b202',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'e750bff3-ebdc-48cb-9862-c1cf2d9e1207',
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/EeYKNa4HQkRAleWXjC5YZbMBMhveB08F1yTTUQSrP97Eow?e=cZdsnA',
    'high-page-views-low-form-views',
    '{"scrapedStatus": false, "trackedFormKPIName": "Form View Rate", "screenshot": "https://spacecat-prod-scraper.s3.us-east-1.amazonaws.com/scrapes/e12c091c-075b-4c94-aab7-398a04412b5c/sweets-and-eats.html/forms/screenshot-desktop-fullpage.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIAZKDIC5H2GIJ7CCGO%2F20250831%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250831T062121Z&X-Amz-Expires=604800&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEI%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJGMEQCIDmFjdQpmaT05AyO9BmXdGIvjQzuqpGlqyY1%2BPLhbB2ZAiB7kzVq%2F%2Fr3Uka%2BcM%2BTZfvJNZJn%2F7XaQDi9e52dwDEnzyqcAwjn%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAAaDDY0MDE2ODQyMTg3NiIMXk1lBM4uhfrP5uC5KvACRIxW2v1IRTkIVJSscX%2BGxQ03FUN3SV0H7A8VqO2F8wktGxNyYQ5Q0SiAUnN1w3mwkOC1OdjHLr2dWLzYXDNiA4zlttQwz0ez6RLdbYHgbO2g6HSUC94FesXmW30h7HuYi6fHl6k%2BI9cltFhkWA9ILxAVGcLqZgGyU%2FNCHdKxUOBXWc11QVXpBYiZUGSW9%2FK6B6nyQXwPaZ9xkUWJ0y%2BYMqIQPNmyuzfWgfmlXgJemOcvshbwRkEMb8d64snp77VNJCRlPy6%2F0%2BhbdhnWZRX45wjSLk6Lvo17Fx%2BX1dv38L61B4TSM%2Fz8a%2B59DeRF1hqy%2FCsMbjV2gfeUY89BtEzCRpkdea8w5hZkmn2cJh7YrHqrlKGqeLi8uk3ZHLcsaOdc7rAq3Wl2u6JW%2BcmEC0qtHC9f16bsKGcwj7XJUwvgE03RWB%2FUgjoBwAnXAO3hI8CaF0PpJJumt70WVk1B6QwQvuX57kNm%2BP2PNvYk8uuEZb0w787PxQY6ngE%2F9P5TdCcxXlxUjzkuaZZRE6C6VsNSs2YnmFAfF9uZxqIEZFNlFJLo0ZDYsRCO63hCjX0mWrdfqfeXc43ICWWcrUs9P%2B%2FLZPIwOAo86r7GVnPoTcdSwC8zEMbZyg379r4bAx131VENAh0S%2FI745DNrAsEnCD2Mr1c%2FmHRQmowcP4fgXaUu%2BNmHoG14wCqWsm38PPARt0Sz5tjwAwH10g%3D%3D&X-Amz-Signature=c87441bfdaec99b8661997612b6d57c68815da5163c8dd1db43470709e166991&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject", "projectedConversionValue": 5088.03, "samples": 4100, "formViews": 400, "formsource": "#container-ad06182763 form#signupForm", "trackedFormKPIValue": 0.098, "form": "https://www.tenant-alpha-secondary.com/sweets-and-eats.html", "pageViews": 4100, "metrics": [{"type": "formViewRate", "device": "*", "value": {"page": 0.098}}, {"type": "formViewRate", "device": "mobile", "value": {"page": 0.091}}, {"type": "formViewRate", "device": "desktop", "value": {"page": 0.125}}, {"type": "traffic", "device": "desktop", "value": {"page": 800}}, {"type": "traffic", "device": "mobile", "value": {"page": 3300}}], "formDetails": {"is_lead_gen": false, "industry": "Food & Beverage", "form_type": "Other (Specify)", "form_category": "B2C", "cpl": 100.18}, "dataSources": ["RUM", "Page"]}'::jsonb,
    'AUTOMATION'::opportunity_origin,
    'Form has low views',
    'The form has low views but the page containing the form has higher traffic',
    'NEW'::opportunity_status,
    '{"recommendations": [{"brief": null, "insight": "Despite receiving 4,100 page views, only 400 users (less than 10%) see the newsletter signup form located in the footer, resulting in low submissions and a high Cost per Lead of $100.18. For the Food & Beverage B2C industry, and an ''Other'' (newsletter/event updates) form type on a Consideration Page, this low field engagement is primarily due to the form being hidden in the page footer without any above-the-fold invitation or clear CTA driving users to engage with it.", "recommendation": "Add a bright, actionable CTA button such as ''Sign Up for Sweet Updates'' or ''Subscribe for News & Offers'' midway or near the top of the page, linking directly to the footer signup, and style it to stand out. For example, after the meal deal or seasonal offers block, insert: ''Want tasty savings & event news? Sign up below!'' with a ''Subscribe'' button leading to the form. This change can be implemented quickly and will capture the interest of users evaluating deals, offering a clear path to signup at moments of high engagement.", "type": "guidance", "rationale": "Most visitors never scroll to the bottom where the ''Let''s Keep in Touch'' form sits, missing the only opportunity to sign up for sweet updates and offers. There is no button, link, or anchored text elsewhere on the page prompting newsletter signup, causing poor visibility and resulting in higher cost per acquired lead, as the form''s exposure is limited to highly engaged scrollers."}, {"brief": null, "insight": "The current ''Be the first to hear about our sweet events, news, and special offers.'' paragraph above the footer form is passive and not framed as an actionable CTA, contributing to a very low engagement rate (under 10% of page viewers) and resulting in a cost impact (CPL $100.18) far above Food & Beverage B2C norms for newsletter acquisition.", "recommendation": "Revise the introductory paragraph before the form to be more directive and actionable: e.g., ''Don''t miss out \u2013 sign up today for exclusive sweet deals, event invites, and Tenant Alpha''s news!'' Pair this copy with a small icon or highlighted styling to draw the eye, helping reinforce the newsletter''s value and increase submissions.", "type": "guidance", "rationale": "Passive copy without a clear call-to-action or interactive element does not prompt users to act. In a consideration page context, users respond much better to direct, engaging invitations that explain the immediate value and use a strong action verb."}, {"brief": null, "insight": "With only 400 form views out of 4,100 visitors (under 10%), the newsletter signup form''s isolated footer placement causes it to miss the majority of traffic, especially mobile users who rarely scroll fully to the bottom\u2014leading to high Cost per Lead ($100.18) and low ROI from page content targeted to Food & Beverage consumers.", "recommendation": "On mobile, add a subtle sticky ''Get Sweet Offers'' CTA button at the bottom or as a floating action above the main menu section, opening a mini signup form or scrolling smoothly to the footer. This ensures visibility regardless of scroll depth and can be easily A/B tested for engagement.", "type": "guidance", "rationale": "Placing the form solely at the footer means only engaged, thorough scrollers will ever see it. This is a missed opportunity, particularly on mobile devices where users are less likely to reach the footer due to shorter browsing times and more distractions."}]}'::jsonb,
    ARRAY['Form Placement']::text[],
    '2025-08-23T02:24:51.379Z'::timestamptz,
    '2025-08-31T17:48:10.392Z'::timestamptz,
    'system'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '9f3732d6-1889-41b3-85d8-763be1e15f93',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    NULL,
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/Ebpoflp2gHFNl4w5-9C7dFEBBHHE4gTaRzHaofqSxJMuuQ?e=Ss6mep',
    'form-accessibility',
    '{"dataSources": ["RUM"], "accessibility": [{"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "formSource": "#groupForm", "a11yIssues": [{"htmlWithIssues": ["<input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Number of Adults (13+), Number of Youth (3-12), Number of Toddlers (0-2) fields have no label", "aiGenerated": false, "level": "A", "guidance": "Adding explicit <label> elements associated with each input ensures they are accessible to everyone, including screen reader users. Example:<br><br><label for=\"adults\">Number of adults:</label><br><input id=\"adults\" name=\"adults\" type=\"number\" min=\"0\" value=\"0\"><br><br><label for=\"youth\">Number of youth:</label><br><input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\"><br><br><label for=\"toddlers\">Number of toddlers:</label><br><input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">", "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\""}, {"htmlWithIssues": ["<div class=\"inputContainer\"><input id=\"firstName\" name=\"firstName\" type=\"text\" placeholder=\"Enter Your First Name\" onkeypress=\"return /^\\s*[a-zA-Z0-9\\\\s]+\\s*$/i.test(event.key)\" class=\"border-error\"><span class=\"error\">Please provide your First Name.</span><i class=\"fal fa-user\" aria-hidden=\"true\"></i></div>", "<div class=\"inputContainer\"><input id=\"lastName\" name=\"lastName\" type=\"text\" placeholder=\"Enter Your Last Name\" onkeypress=\"return /^\\s*[a-zA-Z0-9\\\\s]+\\s*$/i.test(event.key)\" class=\"border-error\"><span class=\"error\">Please provide your Last Name.</span><i class=\"fal fa-user\" aria-hidden=\"true\"></i></div>", "<div class=\"inputContainer\"><input id=\"email\" name=\"email\" data-inputmask=\"''alias'': ''email''\" inputmode=\"email\" placeholder=\"youremail@yourdomain.com\" class=\"border-error\"><span class=\"error\">Please provide your email address.</span><i class=\"fal fa-envelope\" aria-hidden=\"true\"></i></div>", "<select aria-hidden=\"true\" id=\"country\" name=\"country\" tabindex=\"-1\"><option></option><option value=\"Afghanistan\">Afghanistan</option>...<option value=\"Zimbabwe\">Zimbabwe</option></select><span class=\"dropdown-erroralert\">Please select your country.</span>", "<input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/><label for=\"King Size\">King Size</label><input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/><label for=\"Standard Size\">Standard Size</label><input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/><label for=\"Snack Size\">Snack Size</label><input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/><label for=\"Bite Size\">Bite Size</label><span class=\"spnError1\">Please select one of the party package options.</span>", "<input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\"/><label for=\"addonOptionYes\">YES</label><input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\"/><label for=\"addonOptionNo\">NO</label><span class=\"spnError3\">Please select an answer.</span><input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/><label for=\"addonOpt1\">Food </label><input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/><label for=\"addonOpt2\">Retail </label><input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/><label for=\"addonOpt3\">Photos </label><span class=\"spnError2\">Please select an answer.</span>", "<input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\"/><label for=\"arrivalQuestionYes\">YES</label><input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\"/><label for=\"arrivalQuestionNo\">NO</label><span class=\"arrivalError\">Please select an answer.</span>"], "successCriterias": [{"name": "Error Identification", "criteriaNumber": "3.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/error-identification"}], "issue": "First Name, Last Name, Email, Country, Party Package, Add-on Options, Arrival Contact Answer fields have no error association.", "aiGenerated": true, "level": "A", "recommendation": "Add an aria-describedby attribute to each field (selects, radio buttons, checkboxes) pointing to their corresponding error message, or place error messages in a live region clearly identifying the field.", "fieldSelector": ["#groupForm input[name=''firstName'']", "#groupForm input[name=''lastName'']", "#groupForm input[name=''email'']", "#groupForm #country", "#groupForm input[name=''partyPackage'']", "#groupForm input[name=''addonBoolean'']", "#groupForm input[name=''addonOption'']", "#groupForm input[name=''arrivalQuestionBoolean'']"]}, {"htmlWithIssues": ["<span>Party Package</span><div><div><input id=\"King Size\" name=\"partyPackage\" type=\"radio\" value=\"King Size\"/><label for=\"King Size\">King Size</label></div><div><input id=\"Standard Size\" name=\"partyPackage\" type=\"radio\" value=\"Standard Size\"/><label for=\"Standard Size\">Standard Size</label></div><div><input id=\"Snack Size\" name=\"partyPackage\" type=\"radio\" value=\"Snack Size\"/><label for=\"Snack Size\">Snack Size</label></div><div><input id=\"Bite Size\" name=\"partyPackage\" type=\"radio\" value=\"Bite Size\"/><label for=\"Bite Size\">Bite Size</label></div></div><span class=\"spnError1\">Please select one of the party package options.</span>", "<h4>Add-on Options (please check all that apply): </h4><div><div><input id=\"addonOpt1\" name=\"addonOption\" type=\"checkbox\" value=\"Food\"/><label for=\"addonOpt1\">Food </label></div><div><input id=\"addonOpt2\" name=\"addonOption\" type=\"checkbox\" value=\"Retail\"/><label for=\"addonOpt2\">Retail </label></div><div><input id=\"addonOpt3\" name=\"addonOption\" type=\"checkbox\" value=\"Photos\"/><label for=\"addonOpt3\">Photos </label></div></div><span class=\"spnError2\">Please select an answer.</span>", "<span>Are you interested in any add-on options?</span><div><div><input id=\"addonOptionYes\" name=\"addonBoolean\" type=\"radio\" value=\"YES\"/><label for=\"addonOptionYes\">YES</label></div><div><input id=\"addonOptionNo\" name=\"addonBoolean\" type=\"radio\" value=\"NO\"/><label for=\"addonOptionNo\">NO</label></div></div><span class=\"spnError3\">Please select an answer.</span>", "<span>Are you the point of contact during the day of arrival for this group? </span><div><div><input id=\"arrivalQuestionYes\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"YES\"/><label for=\"arrivalQuestionYes\">YES</label></div><div><input id=\"arrivalQuestionNo\" name=\"arrivalQuestionBoolean\" type=\"radio\" value=\"NO\"/><label for=\"arrivalQuestionNo\">NO</label></div></div><span class=\"arrivalError\">Please select an answer.</span>"], "successCriterias": [{"name": "Labels or Instructions", "criteriaNumber": "3.3.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions"}], "issue": "Party Package radio group, Add-on Options checkbox group, ''Are you interested in any add-on options?'' radio group, and ''Are you the point of contact during the day of arrival for this group?'' radio group lack a visible group label associated via <fieldset>/<legend> or ARIA grouping attributes.", "aiGenerated": true, "level": "A", "recommendation": "Group each radio and checkbox set using a <fieldset> and <legend> or a <div role=\"group\" aria-labelledby=\"...\"> to connect visible labels to their controls.", "fieldSelector": ["#groupForm input[name=''partyPackage'']", "#groupForm input[name=''addonOption'']", "#groupForm input[name=''addonBoolean'']", "#groupForm input[name=''arrivalQuestionBoolean'']"]}]}, {"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/groups.html", "formSource": "#groupForm", "a11yIssues": [{"htmlWithIssues": ["<div class=\"inputContainer\"><input id=\"firstName\" name=\"firstName\" type=\"text\" placeholder=\"Enter Your First Name\" onkeypress=\"return /^\\s*[a-zA-Z0-9\\\\s]+\\s*$/i.test(event.key)\" class=\"border-error\"><span class=\"error\">Please provide your First Name.</span><i class=\"fal fa-user\" aria-hidden=\"true\"></i></div>", "<div class=\"inputContainer\"><input id=\"lastName\" name=\"lastName\" type=\"text\" placeholder=\"Enter Your Last Name\" onkeypress=\"return /^\\s*[a-zA-Z0-9\\\\s]+\\s*$/i.test(event.key)\" class=\"border-error\"><span class=\"error\">Please provide your Last Name.</span><i class=\"fal fa-user\" aria-hidden=\"true\"></i></div>", "<div class=\"inputContainer\"><input id=\"email\" name=\"email\" data-inputmask=\"''alias'': ''email''\" inputmode=\"email\" placeholder=\"youremail@yourdomain.com\" class=\"border-error\"><span class=\"error\">Please provide your email address.</span><i class=\"fal fa-envelope\" aria-hidden=\"true\"></i></div>", "<select aria-hidden=\"true\" id=\"country\" name=\"country\" tabindex=\"-1\"><option></option><option value=\"Afghanistan\">Afghanistan</option><option value=\"Albania\">Albania</option><option value=\"Algeria\">Algeria</option></select><span class=\"dropdown-erroralert\">Please select your country.</span>", "<select id=\"groupType\" name=\"groupType\"><option disabled=\"\" hidden=\"\" selected=\"\" value=\"\">Select Group Type</option><option value=\"Seniors\">Seniors</option><option value=\"School\">School</option><option value=\"Students\">Students</option><option value=\"Day Care\">Day Care</option><option value=\"Summer Camp\">Summer Camp</option><option value=\"Church\">Church</option><option value=\"Work\">Work</option><option value=\"Convention\">Convention</option><option value=\"Other\">Other</option></select><span class=\"dropdown-erroralert\">Please select an option</span>"], "successCriterias": [{"name": "Error Identification", "criteriaNumber": "3.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/error-identification"}], "issue": "First Name, Last Name, Email, Country, Group Type fields have no error association", "aiGenerated": true, "level": "A", "recommendation": "Associate the error message with each select control (First Name, Last Name, Email,Country, Group Type) via aria-describedby or place the error text inside a live region that names the field.", "fieldSelector": ["#groupForm #firstName", "#groupForm #lastName", "#groupForm #email", "#groupForm #country", "#groupForm #groupType"]}]}, {"form": "https://www.tenant-alpha-secondary.com/plan-your-visit/private-events-and-meetings/contact.html", "formSource": "#groupForm", "a11yIssues": [{"htmlWithIssues": ["<a href=\"https://www.thetenant-alphacompany.com/en_us/home/privacy-policy.html\" target=\"_blank\" rel=\"noopener noreferrer\">Privacy Policy</a>", "<a href=\"https://www.thetenant-alphacompany.com/en_us/home/terms-and-conditions.html\" target=\"_blank\" rel=\"noopener noreferrer\">Terms and Conditions</a>"], "successCriterias": [{"name": "Contrast (Minimum)", "criteriaNumber": "1.4.3", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"}], "issue": "Elements must meet minimum color contrast ratio thresholds", "aiGenerated": false, "level": "AA", "guidance": "Adjusting the link text color to meet minimum contrast requirements ensures readability for users with low vision. Example:<br><br><a href=\"https://www.thetenant-alphacompany.com/en_us/home/privacy-policy.html\" style=\"color: #005a97; font-weight: bold;\" target=\"_blank\" rel=\"noopener noreferrer\">Privacy Policy</a><br><a href=\"https://www.thetenant-alphacompany.com/en_us/home/terms-and-conditions.html\" style=\"color: #005a97; font-weight: bold;\" target=\"_blank\" rel=\"noopener noreferrer\">Terms and Conditions</a>", "recommendation": "Fix any of the following:\n  Element has insufficient color contrast of 3.94 (foreground color: #007bbd, background color: #feebd0, font size: 12.0pt (16px), font weight: bold). Expected contrast ratio of 4.5:1"}, {"htmlWithIssues": ["<input name=\"adults\" type=\"number\" min=\"0\" id=\"adults\" value=\"0\">", "<input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\">", "<input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">"], "successCriterias": [{"name": "Name, Role, Value", "criteriaNumber": "4.1.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"}], "issue": "Number of Adults (13+), Number of Youth (3-12), Number of Toddlers (0-2) fields have no label", "aiGenerated": false, "level": "A", "guidance": "Providing explicit <label> elements for each input field makes form controls accessible by giving them programmatic and visible names. Example:<br><br><label for=\"adults\">Number of adults:</label><br><input name=\"adults\" type=\"number\" min=\"0\" id=\"adults\" value=\"0\"><br><br><label for=\"youth\">Number of youth:</label><br><input type=\"number\" id=\"youth\" name=\"youth\" min=\"0\" value=\"0\"><br><br><label for=\"toddlers\">Number of toddlers:</label><br><input id=\"toddlers\" type=\"number\" name=\"toddlers\" min=\"0\" value=\"0\">", "recommendation": "Fix any of the following:\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element has no placeholder attribute\n  Element''s default semantics were not overridden with role=\"none\" or role=\"presentation\""}, {"htmlWithIssues": ["<div class=\"inputContainer\"><input id=\"firstName\" name=\"firstName\" type=\"text\" placeholder=\"Enter Your First Name\" onkeypress=\"return /^\\s*[a-zA-Z0-9\\\\s]+\\s*$/i.test(event.key)\" class=\"border-error\"><span class=\"error\">Please provide your First Name.</span><i class=\"fal fa-user\" aria-hidden=\"true\"></i></div>", "<div class=\"inputContainer\"><input id=\"lastName\" name=\"lastName\" type=\"text\" placeholder=\"Enter Your Last Name\" onkeypress=\"return /^\\s*[a-zA-Z0-9\\\\s]+\\s*$/i.test(event.key)\" class=\"border-error\"><span class=\"error\">Please provide your Last Name.</span><i class=\"fal fa-user\" aria-hidden=\"true\"></i></div>", "<div class=\"inputContainer\"><input id=\"email\" name=\"email\" data-inputmask=\"''alias'': ''email''\" inputmode=\"email\" placeholder=\"youremail@yourdomain.com\" class=\"border-error\"><span class=\"error\">Please provide your email address.</span><i class=\"fal fa-envelope\" aria-hidden=\"true\"></i></div>", "<div><div><input id=\"spaceOpt1\" name=\"spaceOption\" type=\"radio\" value=\"Room Nineteen73\"/><label for=\"spaceOpt1\">Room Nineteen73 </label></div><div><input id=\"spaceOpt2\" name=\"spaceOption\" type=\"radio\" value=\"Private Building Rental (before or after operating hours)\"/><label for=\"spaceOpt2\">Private Building Rental (before or after operating hours) </label></div><div><input id=\"spaceOpt3\" name=\"spaceOption\" type=\"radio\" value=\"No preference\"/><label for=\"spaceOpt3\">No preference </label></div></div><span class=\"spnError1\">Please select an answer.</span>", "<div><div><input id=\"eventdiningOptionYes\" name=\"eventdiningBoolean\" type=\"radio\" value=\"YES\"/><label for=\"eventdiningOptionYes\">YES</label></div><div><input id=\"eventdiningOptionNo\" name=\"eventdiningBoolean\" type=\"radio\" value=\"NO\"/><label for=\"eventdiningOptionNo\">NO</label></div></div><span class=\"spnError2\">Please select an answer.</span>"], "successCriterias": [{"name": "Error Identification", "criteriaNumber": "3.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/error-identification"}], "issue": "First Name, Last Name, Email, Phone, Which event space are you interested in?, Are you interested in our dining options? fields have no error association", "aiGenerated": true, "level": "A", "recommendation": "Associate the error messages with each field using aria-describedby or place them in an appropriate live region that clearly references the corresponding field.", "fieldSelector": ["#groupForm #firstName", "#groupForm #lastName", "#groupForm #email", "#groupForm #phone", "#groupForm #spaceOpt1", "#groupForm #eventdiningOptionYes"]}]}, {"form": "https://www.tenant-alpha-secondary.com/contact-us/submit-a-question.html", "formSource": "form.step1-form", "a11yIssues": [{"htmlWithIssues": ["<input type=\"text\" class=\"form-control contact-us-fields-input error-border\" maxlength=\"20\" id=\"firstName\" aria-label=\"First Name\" title=\"First Name\" placeholder=\"First Name*\" aria-required=\"true\" required=\"\">", "<input type=\"text\" class=\"form-control contact-us-fields-input error-border\" maxlength=\"25\" id=\"lastName\" aria-label=\"Last Name\" title=\"Last Name\" placeholder=\"Last Name*\" aria-required=\"true\" required=\"\">", "<input type=\"text\" class=\"form-control contact-us-fields-input error-border\" placeholder=\"mm/dd/yyyy\" maxlength=\"10\" id=\"cwDateField\">", "<input aria-label=\"E-Mail\" aria-required=\"true\" id=\"textEmail\" maxlength=\"50\" placeholder=\"E-Mail*\" required=\"\" title=\"Email Address\" type=\"text\"/>", "<span class=\"errormsg\" id=\"errorMsga\">Please specify a valid E-mail address.</span>", "<textarea class=\"form-control contact-us-fields-input error-border\" id=\"comment\" aria-label=\"Comment\" title=\"Comment\" placeholder=\"Comment*\" aria-required=\"true\" required=\"\"></textarea>"], "successCriterias": [{"name": "Error Identification", "criteriaNumber": "3.3.1", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/error-identification"}], "issue": "First Name, Last Name, Date of Visit, E-Mail, Comment fields have no error association", "aiGenerated": true, "level": "A", "recommendation": "Associate each error message with its corresponding (First Name, Last Name, Date of Visit, E-Mail, Comment) field using aria-describedby or a live region identifying the field.", "fieldSelector": ["form.step1-form #firstName", "form.step1-form #lastName", "form.step1-form #cwDateField", "form.step1-form #textEmail", "form.step1-form #comment"]}, {"htmlWithIssues": ["<input type=\"text\" class=\"form-control contact-us-fields-input error-border\" maxlength=\"20\" id=\"firstName\" aria-label=\"First Name\" title=\"First Name\" placeholder=\"First Name*\" aria-required=\"true\" required=\"\">", "<input type=\"text\" class=\"form-control contact-us-fields-input error-border\" maxlength=\"25\" id=\"lastName\" aria-label=\"Last Name\" title=\"Last Name\" placeholder=\"Last Name*\" aria-required=\"true\" required=\"\">", "<input aria-label=\"E-Mail\" aria-required=\"true\" id=\"textEmail\" maxlength=\"50\" placeholder=\"E-Mail*\" required=\"\" title=\"Email Address\" type=\"text\"/>"], "successCriterias": [{"name": "Labels or Instructions", "criteriaNumber": "3.3.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions"}], "issue": "First Name, Last Name and E-Mail fields lack visible labels or instructions", "aiGenerated": true, "level": "A", "recommendation": "Add a visible and explicitly associated <label> or clear instruction for each field to assist users in understanding what to enter or select.", "fieldSelector": ["form.step1-form #firstName", "form.step1-form #lastName", "form.step1-form #textEmail"]}, {"htmlWithIssues": ["<div><input type=\"radio\" name=\"answerForConsent\" id=\"yes3\" value=\"Y\" aria-required=\"true\" required=\"\"><label class=\"gen-label error-border\" name=\"formCYes\" for=\"yes3\" id=\"formCYesId\">Yes, send it to me</label><input type=\"radio\" name=\"answerForConsent\" id=\"no3\" value=\"N\" aria-required=\"true\" required=\"\"><label class=\"gen-label error-border\" name=\"formCNo\" for=\"no3\" id=\"formCNoId\">No, do not send it to me</label></div>"], "successCriterias": [{"name": "Labels or Instructions", "criteriaNumber": "3.3.2", "understandingUrl": "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions"}], "issue": "Please let us know if we have your permission to contact you field has not grouped via <fieldset>/<legend> or ARIA grouping attributes", "aiGenerated": true, "level": "A", "recommendation": "Group each radio and checkbox set using a <fieldset> and <legend> or a <div role=\"group\" aria-labelledby=\"...\"> to connect visible labels to their controls.", "fieldSelector": ["form.step1-form #no3"]}]}]}'::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Form accessibility report',
    'This report provides an in-depth overview of various accessibility issues identified across different forms. It offers detailed descriptions and recommended fixes. The report covers critical aspects such as ARIA attributes and screen reader compatibility to ensure a more inclusive and accessible form experience for all users.',
    'NEW'::opportunity_status,
    NULL::jsonb,
    ARRAY['Forms Accessibility']::text[],
    '2025-08-14T12:02:26.291Z'::timestamptz,
    '2025-09-03T08:38:28.320Z'::timestamptz,
    '56DC208767F638210A495FB0@7eeb20f8631c0cb7495c06.e'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '44946f2e-2836-4979-bbb9-8069cf19e09e',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    NULL,
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/EeYKNa4HQkRAleWXjC5YZbMBMhveB08F1yTTUQSrP97Eow?e=cZdsnA',
    'high-page-views-low-form-views',
    '{"formViews": 310, "scrapedStatus": true, "trackedFormKPIName": "Form View Rate", "pageViews": 1400, "trackedFormKPIValue": 0.2, "form": "https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html", "opportunityImpact": 1, "metrics": [{"type": "traffic", "device": null, "value": {"paid": 0, "total": 1400, "earned": 0, "owned": 0}}, {"type": "formViewRate", "device": null, "value": {"page": 310}}], "dataSources": ["RUM", "Page"], "projectedConversionValue": 21840}'::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Birthday parties request form has low views',
    'The page containing the form has high traffic, but visitors are not scrolling to the form.',
    'NEW'::opportunity_status,
    '{"recommendations": [{"insight": "On the Birthday Parties page, the request form is located well below the fold, causing low form engagement. While the page\u2019s banner and introductory content capture attention, users often do not scroll far enough to see the form, resulting in missed conversion opportunities.", "recommendation": "Add a prominent call-to-action (CTA) button\u2014such as \u201cBirthday Party Request Form\u201d\u2014in the top banner section that anchors and auto-scrolls users directly to the form. This ensures that interested visitors can access the form immediately without scrolling through the entire page.", "type": "guidance", "rationale": "Placing the form only at the bottom forces users to scroll past multiple content blocks before they can take action. This creates friction and increases drop-off, especially on mobile where scrolling feels longer. By introducing an above-the-fold CTA linked to the form, you leverage the high visibility of the top banner to capture intent early, reduce user effort, and increase the likelihood of form completion."}]}'::jsonb,
    ARRAY['Form Placement']::text[],
    '2025-08-15T06:57:15.567Z'::timestamptz,
    '2025-09-03T10:40:32.283Z'::timestamptz,
    '0D9E1F136787CEAF0A495C4E@7eeb20f8631c0cb7495c06.e'
);
INSERT INTO opportunities (id, site_id, audit_id, runbook, type, data, origin, title, description, status, guidance, tags, created_at, updated_at, updated_by) VALUES (
    '3b27f361-0529-4524-b089-bf6db6ed2ebe',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    NULL,
    'https://adobe.sharepoint.com/:w:/s/AEM_Forms/EeYKNa4HQkRAleWXjC5YZbMBMhveB08F1yTTUQSrP97Eow?e=cZdsnA',
    'high-page-views-low-form-views',
    '{"formViews": 300, "scrapedStatus": true, "trackedFormKPIName": "Form View Rate", "formsource": "#group-form #groupForm", "pageViews": 1200, "trackedFormKPIValue": 0.2, "form": "https://www.tenant-alpha-secondary.com/plan-your-visit/groups.html", "opportunityImpact": 1, "metrics": [{"type": "traffic", "device": null, "value": {"paid": 0, "total": 1200, "earned": 0, "owned": 0}}, {"type": "formViewRate", "device": null, "value": {"page": 300}}], "projectedConversionsIncrease": null, "dataSources": ["RUM", "Page"], "projectedConversionValue": 21840}'::jsonb,
    'ESS_OPS'::opportunity_origin,
    'Group request  form has low views',
    'The page containing the form has high traffic, but visitors are not scrolling to the form.',
    'NEW'::opportunity_status,
    '{"recommendations": [{"insight": "On the Groups page, the group request form is positioned far down the page, making it less likely that visitors will see and interact with it. Although the page draws attention with a strong visual banner and clear value proposition, many users drop off before reaching the form, reducing submission rates.", "recommendation": "Add a high-visibility \"Group Request Form\" CTA button in the top banner section that automatically scrolls users to the form. This ensures interested visitors can take action immediately without having to navigate through the entire page.", "type": "guidance", "rationale": "Placing the form only at the bottom forces users to scroll past multiple content blocks before they can take action. This creates friction and increases drop-off, especially on mobile where scrolling feels longer. By introducing an above-the-fold CTA linked to the form, you leverage the high visibility of the top banner to capture intent early, reduce user effort, and increase the likelihood of form completion."}]}'::jsonb,
    ARRAY['Form Placement']::text[],
    '2025-08-15T07:36:26.849Z'::timestamptz,
    '2025-09-03T10:40:51.612Z'::timestamptz,
    '0D9E1F136787CEAF0A495C4E@7eeb20f8631c0cb7495c06.e'
);

-- Suggestions
INSERT INTO suggestions (id, opportunity_id, type, rank, data, kpi_deltas, status, created_at, updated_at, updated_by) VALUES (
    '9ced44d4-8612-47d2-9dc0-dbc4e01f8f13',
    '698054e3-3fbd-4b1d-bca1-37c094217e82',
    'CONTENT_UPDATE'::suggestion_type,
    1,
    '{"recommendations": [{"pageUrl": null, "id": "e40f4a2d-d553-4fe6-b522-0911090813de", "altText": null, "imageUrl": null}], "suggestionValue": "### Accessibility Compliance Overview\n\nA breakdown of accessibility issues found as a result of audits for the **first 100 pages** traffic wise. \n\n| | Current |Week Over Week |\n|--------|--------|--------|\n|**[Critical](https://experience.adobe.com/?organizationId=04f63783-3f76-4076-bbda-71a11145303c#/@sitesinternal/sites-optimizer/sites/0983c6da-0dee-45cc-b897-3f1fed6b460b/opportunities/8890223a-358c-4f61-97d7-41f72d74b854)**|490|-19% \ud83d\udfe2|\n|**[Serious](https://experience.adobe.com/?organizationId=04f63783-3f76-4076-bbda-71a11145303c#/@sitesinternal/sites-optimizer/sites/0983c6da-0dee-45cc-b897-3f1fed6b460b/opportunities/8890223a-358c-4f61-97d7-41f72d74b854)**|417|-48% \ud83d\udfe2|\n\n---\n\n### Road To WCAG 2.2 Level A\n\n| No of criteria | Passed| Failed| Compliance Score|\n|--------|--------|--------|--------|\n| 30 | 17 | 13 | 56%|\n\n---\n\n### Road To WCAG 2.2  Level AA\n\n| No of criteria | Passed| Failed| Compliance Score|\n|--------|--------|--------|--------|\n| 50 (30 Level A + 20 Level AA) | 34 (17 Level A + 17 Level AA) | 16 (13 Level A + 3 Level AA) | 68%|\n\n---\n\n### Quick Wins\n\nHere is a list of accessibility issues that can be resolved site-wide, having a significant impact with minimal effort, as the changes may be required in only a few places.\n\nSolving the following issues could lead to a decrease of **44.4%** in terms of accessibility issues.\n\n\n| Issue | From Total Issues |Level|Impact|How To Solve|\n|--------|--------|--------|--------|--------|\n| aria-allowed-attr | 19.8% |A |Critical| Remove ARIA attributes (i.e. `aria-selected=\"true\"`) from elements that do not support it like `<div>`. This change can be made in several places for modular components and the results can be seen throughout the entire website.|\n| aria-required-parent| 18.6% | A | Critical | Add ARIA attribute `role=\"group\"` or `role=\"listbox\"` to parents of elements that have `role=\"option\"` (i.e. `<div class=\"cmp-product-slider__item tns-item tns-slide-active\" id=\"tns1-item0\" role=\"option\">`) |\n| meta-viewport| 6%| AA| Critical| Remove `user-scalable=no` attribute from the meta tag|\n\n---\n\n### Accessibility Compliance Issues vs Traffic\n\nAn overview of top 10 pages in terms of traffic with the accessibility issues overview. [Click here](https://experience.adobe.com/?organizationId=04f63783-3f76-4076-bbda-71a11145303c#/@sitesinternal/sites-optimizer/sites/0983c6da-0dee-45cc-b897-3f1fed6b460b/opportunities/7803bf52-5f7c-4407-a27c-b6f51f07c997) to get a more detailed report on enhancing accessibility for top 10 most-visited pages.\n\n| Page | Traffic |Total Issues  |Level A |Level AA |\n|--------|--------|--------|--------|--------|\n| https://www.tenant-alphaland.com/reeses| 986K| 47| 13 x `aria-hidden-focus`, 10 x `nested-interactive`, 8 x `aria-allowed-attr`, 5 x `aria-required-attr`, 11 x `aria-required-parent` | - |\n|https://www.tenant-alphaland.com/tenant-alphas | 687K| 35| 12 x `aria-hidden-focus`, 6 x `nested-interactive`, 6 x `aria-allowed-attr`, 3 x `aria-required-attr`, 8 x `aria-required-parent`| - |\n|https://www.tenant-alphaland.com/reeses/chocolate-lava.html| 659K| 1| - | 1 x `meta-viewport`|\n|https://www.tenant-alphaland.com/jolly-rancher| 625K| 36| 12 x `aria-hidden-focus`, 8 x `nested-interactive`, 4 x `aria-allowed-attr`, 3 x `aria-required-attr`, 9 x `aria-required-parent`| - |\n|https://www.tenant-alphaland.com/ice-breakers| 564K| 30| 12 x `aria-hidden-focus`, 4 x `nested-interactive`, 6 x `aria-allowed-attr`, 2 x `aria-required-attr`, 6 x `aria-required-parent`| - |\n|https://www.tenant-alphaland.com/kisses| 369K| 39|12 x `aria-hidden-focus`, 6 x `nested-interactive`, 10 x `aria-allowed-attr`, 2 x `aria-required-attr`, 8 x `aria-required-parent`, 1 x `image-alt` | - |\n|https://www.tenant-alphaland.com/dots-pretzels| 362K| 38| 12 x `aria-hidden-focus`, 8 x `nested-interactive`, 6 x `aria-allowed-attr`, 3 x `aria-required-attr`, 9 x `aria-required-parent` | - |\n|https://www.tenant-alphaland.com/kit-kat| 310K| 30| 12 x `aria-hidden-focus`, 4 x `nested-interactive`, 6 x `aria-allowed-attr`, 2 x `aria-required-attr`, 6 x `aria-required-parent` | - |\n|https://www.tenant-alphaland.com/skinnypop| 210K| 48| 24 x `aria-hidden-focus`, 8 x `nested-interactive`, 4 x `aria-allowed-attr`, 3 x `aria-required-attr`, 9 x `aria-required-parent` | - |\n| https://www.tenant-alphaland.com/| 132K| 27| 3 x `aria-input-field-name`, 12 x `nested-interactive`, 3 x `aria-required-attr`, 9 x `aria-required-parent`| - |"}'::jsonb,
    '{"estimatedKPILift": 0}'::jsonb,
    'NEW'::suggestion_status,
    '2025-03-13T15:27:14.819Z'::timestamptz,
    '2025-03-26T14:23:41.473Z'::timestamptz,
    'system'
);
INSERT INTO suggestions (id, opportunity_id, type, rank, data, kpi_deltas, status, created_at, updated_at, updated_by) VALUES (
    '36dc8a70-d546-4a67-933e-6d2812576ee4',
    '8890223a-358c-4f61-97d7-41f72d74b854',
    'CONTENT_UPDATE'::suggestion_type,
    1,
    '{"recommendations": [{"pageUrl": null, "id": "882ee749-57cf-44fd-b6b5-fe21aa194d36", "altText": null, "imageUrl": null}], "suggestionValue": "### Accessibility Issues Overview\n\n| Issue | Count| Level |Impact| Description |\n|-------|-------|-------------|-------------|-------------|\n| aria-hidden-focus | 208 | A | Serious |  ARIA hidden element must not be focusable or contain focusable elements |\n| aria-allowed-attr | 198 | A | Critical |  Elements must only use supported ARIA attributes |\n| aria-required-parent | 169 | A | Critical |  Certain ARIA roles must be contained by particular parents |\n| nested-interactive | 148 | A | Serious |  Interactive controls must not be nested |\n| aria-required-attr | 61 | A | Critical |  Required ARIA attributes must be provided |\n| dlitem | 20 | A | Serious |  `<dt>` and `<dd>` elements must be contained by a `<dl>` |\n| aria-input-field-name | 14 | A | Serious |  ARIA input fields must have an accessible name |\n| link-name | 10 | A | Serious |  Links must have discernible text |\n| definition-list | 7 | A | Serious |  `<dl>` elements must only directly contain properly-ordered `<dt>` and `<dd>` groups, `<script>`, `<template>` or `<div>` elements |\n| aria-required-children | 6 | A | Critical |  Certain ARIA roles must contain particular children |\n| aria-prohibited-attr | 6 | A | Serious |  Elements must only use permitted ARIA attributes |\n| image-alt | 1 | A | Critical |  Images must have alternative text |\n| scrollable-region-focusable | 1 | A | Serious |  Scrollable region must have keyboard access |\n| meta-viewport | 55 | AA | Critical |  Zooming and scaling must not be disabled |\n| target-size | 2 | AA | Serious |  All touch targets must be 24px large, or leave sufficient space |\n| color-contrast | 1 | AA | Serious |  Elements must meet minimum color contrast ratio thresholds |\n---\n\n### Keyboard Navigation\n\nThis check implies navigating the website using only the keyboard (e.g., the \u201cTab\u201d key). It is important to test keyboard shortcuts that can access, focus, and activate all interactive elements, such as links, buttons, and form controls. \n\n| Page| Issue| Impact| Recommended fix|\n|--------|--------|--------|--------|\n| https://www.tenant-alphaland.com/reeses | The user cannot focus on the next navigation bar menu item without tabbing through the entire dropdown of subitems. |Critical |Implement arrow keys event to focus on the next element. |\n| https://www.tenant-alphaland.com/reeses | The user can focus on hidden elements in the product carousel and cannot use the next and previous buttons from the carousel|Critical |Make all elements unfocusable, but one. When navigating to the next one make the current one  unfocusable and the next one is focusable by using tabindex 0 & -1.|\n| https://www.tenant-alphaland.com/reeses | The user cannot move past the product carousel unless going through all the items|Critical |Make all elements unfocusable, but one. When navigating to the next one make the current one  unfocusable and the next one is focusable by using tabindex 0 & -1.|\n| https://www.tenant-alphaland.com/reeses | The user is not able to navigate the search results via keyboard |Critical | Add an event listener for enter/space or change `<i>` tags elements into buttons.|\n\n---\n\n### Screen Reader\n\nThis check refers to problems that make it difficult or impossible for screen readers to interpret and convey the content of a website or document to users who rely on them. Furthermore, it makes sure that ARIA roles and attributes are correctly applied to interactive elements like buttons, form controls, and live regions to enhance the screen reader experience. \n\n| Page| Issue| Impact| Recommended fix|\n|--------|--------|--------|--------|\n| https://www.tenant-alphaland.com/reeses | The user is not announced that he focuses on an element that contains a dropdown |Critical |Add aria-haspopup, aria-expanded and aria-controls attributes, so the user.|\n| https://www.tenant-alphaland.com/reeses | The user is not informed of the status of the dropdown (i.e., expanded/collapsed) |Critical |Add attribute of aria-expanded and toggle it if the dropdown is open.|\n| https://www.tenant-alphaland.com/reeses | The user is not announced about the number of results in the search bar|Critical |Add hidden element with the role of alert and set the number of results as text, so when the text changes the screen reader announces the content.|\n\n"}'::jsonb,
    '{"estimatedKPILift": 0}'::jsonb,
    'NEW'::suggestion_status,
    '2025-03-14T11:52:54.196Z'::timestamptz,
    '2025-03-14T12:04:19.708Z'::timestamptz,
    'system'
);
INSERT INTO suggestions (id, opportunity_id, type, rank, data, kpi_deltas, status, created_at, updated_at, updated_by) VALUES (
    'dced3fe7-fc2c-4ede-90ed-b269261528df',
    '7803bf52-5f7c-4407-a27c-b6f51f07c997',
    'CONTENT_UPDATE'::suggestion_type,
    1,
    '{"recommendations": [{"pageUrl": null, "id": "31efa0b7-45be-44da-b1f5-69bbaaefb51a", "altText": null, "imageUrl": null}], "suggestionValue": "| Issue| Level|Pages |Description| How is the user affected| Suggestion|Solution Example|\n|--------|--------|--------|--------|--------|--------|--------|\n|aria-hidden-focus | A | https://www.tenant-alphaland.com/reeses (13), https://www.tenant-alphaland.com/tenant-alphas (12), https://www.tenant-alphaland.com/jolly-rancher (12), https://www.tenant-alphaland.com/ice-breakers (12), https://www.tenant-alphaland.com/kisses (12), https://www.tenant-alphaland.com/dots-pretzels (12), https://www.tenant-alphaland.com/kit-kat (12), https://www.tenant-alphaland.com/skinnypop (24) | ARIA hidden element must not be focusable or contain focusable elements | Elements become inaccessible to assistive technologies like screen readers. This means users won''t be able to interact with or even know about these elements | Add `tabindex=\"-1\"` attribute to focusable content. | Update from `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" tabindex=\"-1\" role=\"option\"><a href=\"/products/tenant-alphas-cookies-n-creme-candy-bar-1-55-oz.html\">` to `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" role=\"option\"><a href=\"/products/tenant-alphas-cookies-n-creme-candy-bar-1-55-oz.html\" tabindex=\"-1\">` | \n|nested-interactive | A | https://www.tenant-alphaland.com/reeses (10), https://www.tenant-alphaland.com/tenant-alphas (6), https://www.tenant-alphaland.com/jolly-rancher (8), https://www.tenant-alphaland.com/ice-breakers (4), https://www.tenant-alphaland.com/kisses (6), https://www.tenant-alphaland.com/dots-pretzels (8), https://www.tenant-alphaland.com/kit-kat (4), https://www.tenant-alphaland.com/skinnypop (8), https://www.tenant-alphaland.com/ (12) |Interactive controls must not be nested | When interactive elements (like buttons or links) are nested within other interactive elements, screen readers may struggle to interpret them correctly. This can result in garbled or incomplete information being conveyed to the user. | Remove `tabindex=\"-1\"` | Update from `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" tabindex=\"-1\" role=\"option\">` to `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" role=\"option\">` |\n|aria-allowed-attr | A | https://www.tenant-alphaland.com/reeses (8), https://www.tenant-alphaland.com/tenant-alphas (6), https://www.tenant-alphaland.com/jolly-rancher (4), https://www.tenant-alphaland.com/ice-breakers (6), https://www.tenant-alphaland.com/kisses (10), https://www.tenant-alphaland.com/dots-pretzels (6), https://www.tenant-alphaland.com/kit-kat (6), https://www.tenant-alphaland.com/skinnypop (4) | Elements must only use supported ARIA attributes | A screen reader cannot interpret an unsupported ARIA attribute, it may not convey important information to the user. | Remove aria-level attribute from the HTML elements that do not support it. | Udpate from `<dt aria-level=\"3\">` to `<dt>`|\n|aria-required-attr | A | https://www.tenant-alphaland.com/reeses (5), https://www.tenant-alphaland.com/tenant-alphas (3), https://www.tenant-alphaland.com/jolly-rancher (3), https://www.tenant-alphaland.com/ice-breakers (2), https://www.tenant-alphaland.com/kisses (2), https://www.tenant-alphaland.com/dots-pretzels (3), https://www.tenant-alphaland.com/kit-kat (2), https://www.tenant-alphaland.com/skinnypop (3), https://www.tenant-alphaland.com/ (3) | Required ARIA attributes must be provided | Without the aria-required attribute, assistive technologies may not provide consistent feedback about required fields. Users might miss important information about which fields need to be filled out. | Add `aria-level` attribute to elements that are used as headings.| Update from `<span role=\"heading\" class=\"h6\">HERSHEY BRANDS</span>` to `<span role=\"heading\" class=\"h6\" aria-level=\"6\">HERSHEY BRANDS</span>` |\n|aria-required-parent | A | https://www.tenant-alphaland.com/reeses (11), https://www.tenant-alphaland.com/tenant-alphas (8), https://www.tenant-alphaland.com/jolly-rancher (9), https://www.tenant-alphaland.com/ice-breakers (6), https://www.tenant-alphaland.com/kisses (8), https://www.tenant-alphaland.com/dots-pretzels (9), https://www.tenant-alphaland.com/kit-kat (6), https://www.tenant-alphaland.com/skinnypop (9), https://www.tenant-alphaland.com/ (9) | Certain ARIA roles must be contained by particular parents | he absence of required parent roles can result in an inconsistent and unpredictable user experience. Users might not receive the necessary feedback or interaction cues from assistive technologies | Add `role=\"group\"` or `role=\"listbox\"` attribute to parents of elements with `role=\"option\"` attribute. | Update from `<div class=\"my-slider text-container_slider containerID-slider-384078991  itemtoshow3 product-slider  tns-slider tns-carousel tns-subpixel tns-calc tns-horizontal\" id=\"tns1\"><div class=\"cmp-product-slider__item removeBG tns-item tns-slide-active\" id=\"tns1-item0\" role=\"option\">` to `<div class=\"my-slider text-container_slider containerID-slider-384078991  itemtoshow3 product-slider  tns-slider tns-carousel tns-subpixel tns-calc tns-horizontal\" id=\"tns1\" role=\"listbox\"><div class=\"cmp-product-slider__item removeBG tns-item tns-slide-active\" id=\"tns1-item0\" role=\"option\">` |\n|meta-viewport | AA | https://www.tenant-alphaland.com/reeses/chocolate-lava.html (1) | Zooming and scaling must not be disabled | Users with low vision or other visual disabilities may find text unreadable if they cannot adjust the size. This can lead to frustration and difficulty in accessing the content | Remove user-scalable=no attribute from the meta tag. | Update from `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0,maximum-scale=1.0, user-scalable=no\">` to `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0,maximum-scale=1.0\">` |\n|aria-input-field-name | A | https://www.tenant-alphaland.com/ (3) | ARIA input fields must have an accessible name | Without an accessible name, users may not understand the purpose of the input field. For example, a screen reader might only announce \"edit\" or \"input\" without providing context, making it difficult for users to know what information is required. | Add aria-label attribute to sliders | Update from `<div class=\"cmp-slider  quick-links default-slider\" animation-apply=\"true\" animation-direction=\"default\" animation-direction-mobile=\"left\" animation-speed=\"1\" parallax-speed=\"10\" parallax-apply=\"false\" animation-distance=\"100px\" aria-labelledby=\"sliderLabel\" role=\"slider\">` to `<div class=\"cmp-slider  quick-links default-slider\" animation-apply=\"true\" animation-direction=\"default\" animation-direction-mobile=\"left\" animation-speed=\"1\" parallax-speed=\"10\" parallax-apply=\"false\" animation-distance=\"100px\" aria-label=\"springtime-products\" role=\"slider\">`|\n\n"}'::jsonb,
    '{"estimatedKPILift": 0}'::jsonb,
    'NEW'::suggestion_status,
    '2025-03-14T12:07:36.490Z'::timestamptz,
    '2025-03-14T14:23:04.145Z'::timestamptz,
    'system'
);
INSERT INTO suggestions (id, opportunity_id, type, rank, data, kpi_deltas, status, created_at, updated_at, updated_by) VALUES (
    '1450b134-4a8c-4f19-b597-a0cb99a60df0',
    'b3ed2031-0d1a-4107-9f33-21df545ebd52',
    'CONTENT_UPDATE'::suggestion_type,
    1,
    '{"recommendations": [{"pageUrl": null, "id": "5b3f3abb-0105-45e3-9cbc-56e32d871815", "altText": null, "imageUrl": null}], "suggestionValue": "### Accessibility Issues Overview\n\n| Issue | Count| Level |Impact| Description |\n|-------|-------|-------------|-------------|-------------|\n| aria-required-parent | 285 | A | Critical |  Certain ARIA roles must be contained by particular parents |\n| aria-hidden-focus | 271 | A | Serious |  ARIA hidden element must not be focusable or contain focusable elements |\n| aria-allowed-attr | 256 | A | Critical |  Elements must only use supported ARIA attributes |\n| nested-interactive | 241 | A | Serious |  Interactive controls must not be nested |\n| dlitem | 94 | A | Serious |  `<dt>` and `<dd>` elements must be contained by a `<dl>` |\n| aria-required-attr | 85 | A | Critical |  Required ARIA attributes must be provided |\n| button-name | 46 | A | Critical |  Buttons must have discernible text |\n| definition-list | 29 | A | Serious |  `<dl>` elements must only directly contain properly-ordered `<dt>` and `<dd>` groups, `<script>`, `<template>` or `<div>` elements |\n| link-name | 27 | A | Serious |  Links must have discernible text |\n| aria-prohibited-attr | 23 | A | Serious |  Elements must only use permitted ARIA attributes |\n| aria-input-field-name | 17 | A | Serious |  ARIA input fields must have an accessible name |\n| image-alt | 4 | A | Critical |  Images must have alternative text |\n| role-img-alt | 2 | A | Serious |  [role=\"img\"] elements must have an alternative text |\n| scrollable-region-focusable | 2 | A | Serious |  Scrollable region must have keyboard access |\n| aria-required-children | 1 | A | Critical |  Certain ARIA roles must contain particular children |\n| color-contrast | 72 | AA | Serious |  Elements must meet minimum color contrast ratio thresholds |\n| target-size | 3 | AA | Serious |  All touch targets must be 24px large, or leave sufficient space |\n| meta-viewport | 2 | AA | Critical |  Zooming and scaling must not be disabled |\n"}'::jsonb,
    '{"estimatedKPILift": 0}'::jsonb,
    'NEW'::suggestion_status,
    '2025-03-26T14:12:01.077Z'::timestamptz,
    '2025-03-26T14:12:01.078Z'::timestamptz,
    'system'
);
INSERT INTO suggestions (id, opportunity_id, type, rank, data, kpi_deltas, status, created_at, updated_at, updated_by) VALUES (
    '734463f4-2a6d-4220-9fed-bb2d10813b56',
    '9de4cffb-5be1-4647-a169-3b71b31aea83',
    'CONTENT_UPDATE'::suggestion_type,
    1,
    '{"recommendations": [{"pageUrl": null, "id": "45e2dcda-af32-41b1-ba0b-9004e02ab19e", "altText": null, "imageUrl": null}], "suggestionValue": "### Enhancing accessibility for the top 10 most-visited pages\n\n| Issue | Level| Pages |Description| How is the user affected | Suggestion | Solution Example |\n|-------|-------|-------------|-------------|-------------|-------------|-------------|\n| aria-hidden-focus | A | https://www.tenant-alphaland.com/reeses (13), https://www.tenant-alphaland.com/tenant-alphas (12), https://www.tenant-alphaland.com/jolly-rancher (12), https://www.tenant-alphaland.com/ice-breakers (12), https://www.tenant-alphaland.com/kisses (12), https://www.tenant-alphaland.com/dots-pretzels (12), https://www.tenant-alphaland.com/kit-kat (12), https://www.tenant-alphaland.com/skinnypop (24) | ARIA hidden element must not be focusable or contain focusable elements | Screen reader users receive confusing information when elements marked as hidden can still receive focus, creating a discrepancy between visual presentation and accessibility tree. | Remove `aria-hidden=\"true\"` from elements that contain focusable elements, or ensure all focusable elements within hidden containers also have tabindex=\"-1\". | Update from `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" tabindex=\"-1\" role=\"option\"><div class=\"cmp-product-slider__content\"><div class=\"cmp-product-slider__image\"><a href=\"/products/reeses-milk-chocolate-snack-size-peanut-butter-cups-10-5-oz-bag.html\">...</a></div></div></div>` to `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" tabindex=\"-1\" role=\"option\"><div class=\"cmp-product-slider__content\"><div class=\"cmp-product-slider__image\"><a href=\"/products/reeses-milk-chocolate-snack-size-peanut-butter-cups-10-5-oz-bag.html\" tabindex=\"-1\">...</a></div></div></div>` |\n| nested-interactive | A | https://www.tenant-alphaland.com/reeses (10), https://www.tenant-alphaland.com/tenant-alphas (6), https://www.tenant-alphaland.com/reeses/chocolate-lava.html (6), https://www.tenant-alphaland.com/jolly-rancher (8), https://www.tenant-alphaland.com/ice-breakers (4), https://www.tenant-alphaland.com/kisses (6), https://www.tenant-alphaland.com/dots-pretzels (8), https://www.tenant-alphaland.com/kit-kat (4), https://www.tenant-alphaland.com/skinnypop (8), https://www.tenant-alphaland.com/ (12) | Interactive controls must not be nested | When interactive elements (like buttons or links) are nested within other interactive elements, screen readers may struggle to interpret them correctly. This can result in garbled or incomplete information being conveyed to the user. | Remove tabindex=\"-1\" | Update from `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" tabindex=\"-1\" role=\"option\">` to `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" role=\"option\">` |\n| aria-allowed-attr | A | https://www.tenant-alphaland.com/reeses (8), https://www.tenant-alphaland.com/tenant-alphas (6), https://www.tenant-alphaland.com/jolly-rancher (4), https://www.tenant-alphaland.com/ice-breakers (6), https://www.tenant-alphaland.com/kisses (10), https://www.tenant-alphaland.com/dots-pretzels (6), https://www.tenant-alphaland.com/kit-kat (6), https://www.tenant-alphaland.com/skinnypop (4) | Elements must only use supported ARIA attributes | A screen reader cannot interpret an unsupported ARIA attribute, it may not convey important information to the user. | Remove `aria-level` attribute from the HTML elements that do not support it. | Update from `<dt aria-level=\"3\">` to `<dt>` |\n| aria-required-parent | A | https://www.tenant-alphaland.com/reeses (11), https://www.tenant-alphaland.com/tenant-alphas (8), https://www.tenant-alphaland.com/reeses/chocolate-lava.html (5), https://www.tenant-alphaland.com/jolly-rancher (9), https://www.tenant-alphaland.com/ice-breakers (6), https://www.tenant-alphaland.com/kisses (8), https://www.tenant-alphaland.com/dots-pretzels (9), https://www.tenant-alphaland.com/kit-kat (6), https://www.tenant-alphaland.com/skinnypop (9), https://www.tenant-alphaland.com/ (9) | Certain ARIA roles must be contained by particular parents | The absence of required parent roles can result in an inconsistent and unpredictable user experience. Users might not receive the necessary feedback or interaction cues from assistive technologies | Add `role=\"group\"` or `role=\"listbox\"` attribute to parents of elements with `role=\"option\"` attribute. | Update from `<div class=\"my-slider text-container_slider containerID-slider-384078991 itemtoshow3 product-slider tns-slider tns-carousel tns-subpixel tns-calc tns-horizontal\" id=\"tns1\"><div class=\"cmp-product-slider__item removeBG tns-item tns-slide-active\" id=\"tns1-item0\" role=\"option\">` to `<div class=\"my-slider text-container_slider containerID-slider-384078991 itemtoshow3 product-slider tns-slider tns-carousel tns-subpixel tns-calc tns-horizontal\" id=\"tns1\" role=\"listbox\"><div class=\"cmp-product-slider__item removeBG tns-item tns-slide-active\" id=\"tns1-item0\" role=\"option\">` |\n| aria-required-attr | A | https://www.tenant-alphaland.com/reeses (5), https://www.tenant-alphaland.com/tenant-alphas (3), https://www.tenant-alphaland.com/reeses/chocolate-lava.html (1), https://www.tenant-alphaland.com/jolly-rancher (3), https://www.tenant-alphaland.com/ice-breakers (2), https://www.tenant-alphaland.com/kisses (2), https://www.tenant-alphaland.com/dots-pretzels (3), https://www.tenant-alphaland.com/kit-kat (2), https://www.tenant-alphaland.com/skinnypop (3), https://www.tenant-alphaland.com/ (3) | Required ARIA attributes must be provided | Without the aria-required attribute, assistive technologies may not provide consistent feedback about required fields. Users might miss important information about which fields need to be filled out. | Add `aria-level` attribute to elements that are used as headings. | Update from `<span role=\"heading\" class=\"h6\">HERSHEY BRANDS</span>` to `<span role=\"heading\" class=\"h6\" aria-level=\"6\">HERSHEY BRANDS</span>` |\n| aria-input-field-name | A | https://www.tenant-alphaland.com/reeses/chocolate-lava.html (1), https://www.tenant-alphaland.com/ (3) | ARIA input fields must have an accessible name | Without an accessible name, users may not understand the purpose of the input field. For example, a screen reader might only announce \"edit\" or \"input\" without providing context, making it difficult for users to know what information is required. | Add `aria-label` attribute to sliders | Update from `<div class=\"cmp-slider quick-links default-slider\" animation-apply=\"true\" animation-direction=\"default\" animation-direction-mobile=\"left\" animation-speed=\"1\" parallax-speed=\"10\" parallax-apply=\"false\" animation-distance=\"100px\" aria-labelledby=\"sliderLabel\" role=\"slider\">` to `<div class=\"cmp-slider quick-links default-slider\" animation-apply=\"true\" animation-direction=\"default\" animation-direction-mobile=\"left\" animation-speed=\"1\" parallax-speed=\"10\" parallax-apply=\"false\" animation-distance=\"100px\" aria-label=\"springtime-products\" role=\"slider\">` |"}'::jsonb,
    '{"estimatedKPILift": 0}'::jsonb,
    'NEW'::suggestion_status,
    '2025-03-26T14:26:24.842Z'::timestamptz,
    '2025-03-26T14:26:24.842Z'::timestamptz,
    'system'
);
INSERT INTO suggestions (id, opportunity_id, type, rank, data, kpi_deltas, status, created_at, updated_at, updated_by) VALUES (
    'd957599f-20e5-4855-bec1-4c9b342c0d31',
    '6486da2a-2327-4f14-b75e-4ec16d7bdc82',
    'CONTENT_UPDATE'::suggestion_type,
    1,
    '{"recommendations": [{"pageUrl": null, "id": "f36738a4-0be9-4084-a7f0-235b3ae440fe", "altText": null, "imageUrl": null}], "suggestionValue": "### Accessibility Compliance Overview\n\nA breakdown of accessibility issues found as a result of audits for the **first 100 pages** traffic wise. \n\n| | Current |Week Over Week |\n|--------|--------|--------|\n| [**Critical**](https://experience.adobe.com/?organizationId=04f63783-3f76-4076-bbda-71a11145303c#/@sitesinternal/sites-optimizer/sites/0983c6da-0dee-45cc-b897-3f1fed6b460b/opportunities/b3ed2031-0d1a-4107-9f33-21df545ebd52)| 679 |  38.57% \ud83d\udd34|\n| [**Serious**](https://experience.adobe.com/?organizationId=04f63783-3f76-4076-bbda-71a11145303c#/@sitesinternal/sites-optimizer/sites/0983c6da-0dee-45cc-b897-3f1fed6b460b/opportunities/b3ed2031-0d1a-4107-9f33-21df545ebd52)| 783 | 87.77% \ud83d\udd34|\n\n---\n\n### Road To WCAG 2.2 Level A\n\n| No of criteria | Passed| Failed| Compliance Score|\n|--------|--------|--------|--------|\n| 30 | 15 | 15 |  50%|\n\n---\n\n### Road To WCAG 2.2  Level AA\n\n| No of criteria | Passed| Failed| Compliance Score|\n|--------|--------|--------|--------|\n| 50 (30 Level A + 20 Level AA) | 32 (15 Level A + 17 Level AA) |  18 (15 Level A +  3 Level AA) | 64%|\n\n---\n\n### Quick Wins\n\nHere is a list of accessibility issues that can be resolved site-wide, having a significant impact with minimal effort, as the changes may be required in only a few places.\n\nSolving the below issues could decrease accessibility issues by **55.55%**.\n\n| Issue | % of Total |Level|Impact|How To Solve|\n|--------|--------|--------|--------|--------|\n| Certain ARIA roles must be contained by particular parents | 19.50% | A | Critical | Add appropriate parent containers with required roles (e.g., add `role=\"listbox\"` to parent containers of elements with `role=\"option\"`). |\n| ARIA hidden element must not be focusable or contain focusable elements | 18.54% | A | Serious | Add `tabindex=\"-1\"` to all focusable elements inside containers with `aria-hidden=\"true\"` or remove the aria-hidden attribute. |\n| Elements must only use supported ARIA attributes | 17.51% | A | Critical | Remove ARIA attributes (i.e. aria-level=\"3\") from elements that do not support them like `<dt>`. |\n\n---\n\n### Accessibility Compliance Issues vs Traffic | [In-Depth Report](https://experience.adobe.com/?organizationId=04f63783-3f76-4076-bbda-71a11145303c#/@sitesinternal/sites-optimizer/sites/0983c6da-0dee-45cc-b897-3f1fed6b460b/opportunities/9de4cffb-5be1-4647-a169-3b71b31aea83)\n\nAn overview of top 10 pages in terms of traffic with the accessibility issues overview\n\n| Page | Traffic |Total Issues  |Level A |Level AA |\n|--------|--------|--------|--------|--------|\n| https://www.tenant-alphaland.com/reeses | 986.7K | 47 | 13 x `aria-hidden-focus`, 10 x `nested-interactive`, 8 x `aria-allowed-attr`, 5 x `aria-required-attr`, 11 x `aria-required-parent` | - |\n| https://www.tenant-alphaland.com/tenant-alphas | 687.8K | 35 | 12 x `aria-hidden-focus`, 6 x `nested-interactive`, 6 x `aria-allowed-attr`, 3 x `aria-required-attr`, 8 x `aria-required-parent` | - |\n| https://www.tenant-alphaland.com/reeses/chocolate-lava.html | 659.7K | 16 | 1 x `aria-input-field-name`, 6 x `nested-interactive`, 1 x `role-img-alt`, 1 x `aria-required-attr`, 5 x `aria-required-parent`, 2 x `image-alt` | - |\n| https://www.tenant-alphaland.com/jolly-rancher | 625.8K | 36 | 12 x `aria-hidden-focus`, 8 x `nested-interactive`, 4 x `aria-allowed-attr`, 3 x `aria-required-attr`, 9 x `aria-required-parent` | - |\n| https://www.tenant-alphaland.com/ice-breakers | 564.6K | 30 | 12 x `aria-hidden-focus`, 4 x `nested-interactive`, 6 x `aria-allowed-attr`, 2 x `aria-required-attr`, 6 x `aria-required-parent` | - |\n| https://www.tenant-alphaland.com/kisses | 369.5K | 39 | 12 x `aria-hidden-focus`, 6 x `nested-interactive`, 10 x `aria-allowed-attr`, 2 x `aria-required-attr`, 8 x `aria-required-parent`, 1 x `image-alt` | - |\n| https://www.tenant-alphaland.com/dots-pretzels | 362.3K | 40 | 12 x `aria-hidden-focus`, 8 x `nested-interactive`, 6 x `aria-allowed-attr`, 3 x `aria-required-attr`, 9 x `aria-required-parent` | - |\n| https://www.tenant-alphaland.com/kit-kat | 310.6K | 30 | 12 x `aria-hidden-focus`, 4 x `nested-interactive`, 6 x `aria-allowed-attr`, 2 x `aria-required-attr`, 6 x `aria-required-parent` | - |\n| https://www.tenant-alphaland.com/skinnypop | 210.8K | 48 | 24 x `aria-hidden-focus`, 8 x `nested-interactive`, 4 x `aria-allowed-attr`, 3 x `aria-required-attr`, 9 x `aria-required-parent` | - |\n| https://www.tenant-alphaland.com/ | 132.4K | 27 | 3 x `aria-input-field-name`, 12 x `nested-interactive`, 3 x `aria-required-attr`, 9 x `aria-required-parent` | - |"}'::jsonb,
    '{"estimatedKPILift": 0}'::jsonb,
    'NEW'::suggestion_status,
    '2025-03-26T14:10:19.271Z'::timestamptz,
    '2025-03-27T10:40:51.940Z'::timestamptz,
    'system'
);
INSERT INTO suggestions (id, opportunity_id, type, rank, data, kpi_deltas, status, created_at, updated_at, updated_by) VALUES (
    '455957ba-5b66-4af0-9f55-7d2674adfb85',
    'fd61d378-fccf-4f13-a47e-067e74bf7f27',
    'CONTENT_UPDATE'::suggestion_type,
    1,
    '{"recommendations": [{"pageUrl": null, "id": "d8a38fe0-fa68-46ad-805f-671ad18ec9ae", "altText": null, "imageUrl": null}], "suggestionValue": "### Enhancing accessibility for the top 10 most-visited pages\n\n| Issue | Level| Pages |Description| How is the user affected | Suggestion | Solution Example |\n|-------|-------|-------------|-------------|-------------|-------------|-------------|\n| aria-required-parent | A | https://www.tenant-alphaland.com/reeses (11), https://www.tenant-alphaland.com/tenant-alphas (8), https://www.tenant-alphaland.com/reeses/chocolate-lava.html (5), https://www.tenant-alphaland.com/jolly-rancher (8), https://www.tenant-alphaland.com/ice-breakers (6), https://www.tenant-alphaland.com/kisses (8), https://www.tenant-alphaland.com/dots-pretzels (9), https://www.tenant-alphaland.com/kit-kat (6), https://www.tenant-alphaland.com/skinnypop (9) | Certain ARIA roles must be contained by particular parents | Screen reader users receive incomplete or incorrect information about content organization. When elements require specific parent roles but don''t have them, the hierarchical relationship is broken, making navigation confusing and unpredictable. | Add `role=\"group\"` or `role=\"listbox\"` attribute to parents of elements with `role=\"option\"` attribute. | Update from `<div class=\"my-slider text-container_slider containerID-slider-384078991 itemtoshow3 product-slider tns-slider tns-carousel tns-subpixel tns-calc tns-horizontal\" id=\"tns1\"><div class=\"cmp-product-slider__item removeBG tns-item tns-slide-active\" id=\"tns1-item0\" role=\"option\">` to `<div class=\"my-slider text-container_slider containerID-slider-384078991 itemtoshow3 product-slider tns-slider tns-carousel tns-subpixel tns-calc tns-horizontal\" id=\"tns1\" role=\"listbox\"><div class=\"cmp-product-slider__item removeBG tns-item tns-slide-active\" id=\"tns1-item0\" role=\"option\">` |\n| nested-interactive | A | https://www.tenant-alphaland.com/reeses (10), https://www.tenant-alphaland.com/tenant-alphas (6), https://www.tenant-alphaland.com/reeses/chocolate-lava.html (6), https://www.tenant-alphaland.com/jolly-rancher (7), https://www.tenant-alphaland.com/ice-breakers (4), https://www.tenant-alphaland.com/kisses (6), https://www.tenant-alphaland.com/dots-pretzels (8), https://www.tenant-alphaland.com/kit-kat (4), https://www.tenant-alphaland.com/skinnypop (8) | Interactive controls must not be nested | Screen reader and keyboard users face accessibility barriers when interactive controls are nested within other interactive elements. This creates unpredictable behavior, incomplete announcements, and potentially unusable features that trap or skip focus. | Remove tabindex=\"-1\". | Update from `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" tabindex=\"-1\" role=\"option\">` to `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" role=\"option\">` |\n| aria-required-attr | A | https://www.tenant-alphaland.com/reeses (5), https://www.tenant-alphaland.com/tenant-alphas (3), https://www.tenant-alphaland.com/reeses/chocolate-lava.html (1), https://www.tenant-alphaland.com/jolly-rancher (3), https://www.tenant-alphaland.com/ice-breakers (2), https://www.tenant-alphaland.com/kisses (2), https://www.tenant-alphaland.com/dots-pretzels (3), https://www.tenant-alphaland.com/kit-kat (2), https://www.tenant-alphaland.com/skinnypop (3) | Required ARIA attributes must be provided | Screen reader users receive incomplete information about an element''s purpose or state when required ARIA attributes are missing. This prevents users from understanding how to interact with elements or their current state. | Add `aria-level` attribute to elements that are used as headings. | Update from `<span role=\"heading\" class=\"h6\">HERSHEY BRANDS</span>` to `<span role=\"heading\" class=\"h6\" aria-level=\"6\">HERSHEY BRANDS</span>` |\n| aria-hidden-focus | A | https://www.tenant-alphaland.com/reeses (13), https://www.tenant-alphaland.com/tenant-alphas (12), https://www.tenant-alphaland.com/jolly-rancher (12), https://www.tenant-alphaland.com/ice-breakers (12), https://www.tenant-alphaland.com/kisses (12), https://www.tenant-alphaland.com/dots-pretzels (12), https://www.tenant-alphaland.com/kit-kat (12), https://www.tenant-alphaland.com/skinnypop (24) | ARIA hidden element must not be focusable or contain focusable elements | Keyboard and screen reader users experience confusing interfaces when elements hidden from screen readers (aria-hidden=\"true\") remain focusable. Users can focus on elements they cannot perceive, creating a disconnected experience where their cursor appears to \"disappear\". | Remove `aria-hidden=\"true\"` from elements that contain focusable elements, or ensure all focusable elements within hidden containers also have tabindex=\"-1\". | Update from `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" tabindex=\"-1\" role=\"option\"><div class=\"cmp-product-slider__content\"><div class=\"cmp-product-slider__image\"><a href=\"/products/reeses-milk-chocolate-snack-size-peanut-butter-cups-10-5-oz-bag.html\">...</a></div></div></div>` to `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" tabindex=\"-1\" role=\"option\"><div class=\"cmp-product-slider__content\"><div class=\"cmp-product-slider__image\"><a href=\"/products/reeses-milk-chocolate-snack-size-peanut-butter-cups-10-5-oz-bag.html\" tabindex=\"-1\">...</a></div></div></div>` |\n| aria-allowed-attr | A | https://www.tenant-alphaland.com/reeses (8), https://www.tenant-alphaland.com/tenant-alphas (6), https://www.tenant-alphaland.com/jolly-rancher (4), https://www.tenant-alphaland.com/ice-breakers (6), https://www.tenant-alphaland.com/kisses (10), https://www.tenant-alphaland.com/dots-pretzels (6), https://www.tenant-alphaland.com/kit-kat (6), https://www.tenant-alphaland.com/skinnypop (4) | Elements must only use supported ARIA attributes | Screen reader users receive misleading or nonsensical information when elements use ARIA attributes they don''t support. This causes confusion when the announced content doesn''t match the expected behavior of the element. | Remove `aria-level` attribute from the HTML elements that do not support it. | Update from `<dt aria-level=\"3\">` to `<dt>` |\n"}'::jsonb,
    '{"estimatedKPILift": 0}'::jsonb,
    'NEW'::suggestion_status,
    '2025-04-02T12:34:23.195Z'::timestamptz,
    '2025-04-02T12:34:23.195Z'::timestamptz,
    'system'
);
INSERT INTO suggestions (id, opportunity_id, type, rank, data, kpi_deltas, status, created_at, updated_at, updated_by) VALUES (
    '5a4d4730-6c52-4a16-b17f-be35ed7d7fc9',
    '0c9e2e1f-c2b2-45df-8e66-eb0a18ea781c',
    'CONTENT_UPDATE'::suggestion_type,
    1,
    '{"recommendations": [{"pageUrl": null, "id": "d8a38fe0-fa68-46ad-805f-671ad18ec9ae", "altText": null, "imageUrl": null}], "suggestionValue": "### Accessibility Issues Overview\n\n| Issue | Count| Level |Impact| Description |\n|-------|-------|-------------|-------------|-------------|\n| aria-required-parent | 349 | A | Critical | Certain ARIA roles must be contained by particular parents |\n| aria-hidden-focus | 299 | A | Serious | ARIA hidden element must not be focusable or contain focusable elements |\n| nested-interactive | 270 | A | Serious | Interactive controls must not be nested |\n| aria-allowed-attr | 267 | A | Critical | Elements must only use supported ARIA attributes |\n| aria-required-attr | 136 | A | Critical | Required ARIA attributes must be provided |\n| image-alt | 106 | A | Critical | Images must have alternative text |\n| dlitem | 98 | A | Serious | <dt> and <dd> elements must be contained by a <dl> |\n| aria-input-field-name | 63 | A | Serious | ARIA input fields must have an accessible name |\n| button-name | 46 | A | Critical | Buttons must have discernible text |\n| definition-list | 30 | A | Serious | <dl> elements must only directly contain properly-ordered <dt> and <dd> groups, <script>, <template> or <div> elements |\n| link-name | 27 | A | Serious | Links must have discernible text |\n| aria-prohibited-attr | 23 | A | Serious | Elements must only use permitted ARIA attributes |\n| scrollable-region-focusable | 2 | A | Serious | Scrollable region must have keyboard access |\n| aria-required-children | 1 | A | Critical | Certain ARIA roles must contain particular children |\n| color-contrast | 10 | AA | Serious | Elements must meet minimum color contrast ratio thresholds |\n| target-size | 2 | AA | Serious | All touch targets must be 24px large, or leave sufficient space |\n"}'::jsonb,
    '{"estimatedKPILift": 0}'::jsonb,
    'NEW'::suggestion_status,
    '2025-04-02T12:34:51.537Z'::timestamptz,
    '2025-04-02T12:34:51.537Z'::timestamptz,
    'system'
);
INSERT INTO suggestions (id, opportunity_id, type, rank, data, kpi_deltas, status, created_at, updated_at, updated_by) VALUES (
    '360d1137-935b-409f-8430-500e2d4f02aa',
    '5f257522-2b5a-4b15-8398-d26313aaa963',
    'CONTENT_UPDATE'::suggestion_type,
    1,
    '{"recommendations": [{"pageUrl": null, "id": "d8a38fe0-fa68-46ad-805f-671ad18ec9ae", "altText": null, "imageUrl": null}], "suggestionValue": "### Accessibility Issues Overview\n\n| Issue | WCAG Success Criterion | Count| Level |Impact| Description | WCAG Docs Link |\n|-------|-------|-------------|-------------|-------------|-------------|-------------|\n| aria-required-parent | [1.3.1 Info and Relationships](https://www.w3.org/TR/WCAG/#info-and-relationships) |349 | A | Critical | Certain ARIA roles must be contained by particular parents | https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html |\n| aria-hidden-focus | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) |299 | A | Serious | ARIA hidden element must not be focusable or contain focusable elements | https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html |\n| nested-interactive | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) |270 | A | Serious | Interactive controls must not be nested | https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html |\n| aria-allowed-attr | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) |267 | A | Critical | Elements must only use supported ARIA attributes | https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html |\n| aria-required-attr | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) |136 | A | Critical | Required ARIA attributes must be provided | https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html |\n| image-alt | [1.1.1 Non-text Content](https://www.w3.org/TR/WCAG/#non-text-content) |103 | A | Critical | Images must have alternative text | https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html |\n| dlitem | [1.3.1 Info and Relationships](https://www.w3.org/TR/WCAG/#info-and-relationships) |98 | A | Serious | <dt> and <dd> elements must be contained by a <dl> | https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html |\n| aria-input-field-name | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) |63 | A | Serious | ARIA input fields must have an accessible name | https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html |\n| button-name | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) |46 | A | Critical | Buttons must have discernible text | https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html |\n| definition-list | [1.3.1 Info and Relationships](https://www.w3.org/TR/WCAG/#info-and-relationships) |30 | A | Serious | <dl> elements must only directly contain properly-ordered <dt> and <dd> groups, <script>, <template> or <div> elements | https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html |\n| link-name | [2.4.4 Link Purpose (In Context)](https://www.w3.org/TR/WCAG/#link-purpose-in-context) |27 | A | Serious | Links must have discernible text | https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html |\n| aria-prohibited-attr | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) |23 | A | Serious | Elements must only use permitted ARIA attributes | https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html |\n| scrollable-region-focusable | [2.1.1 Keyboard](https://www.w3.org/TR/WCAG/#keyboard) |2 | A | Serious | Scrollable region must have keyboard access | https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html |\n| aria-required-children | [1.3.1 Info and Relationships](https://www.w3.org/TR/WCAG/#info-and-relationships) |1 | A | Critical | Certain ARIA roles must contain particular children | https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html |\n| color-contrast | [1.4.3 Contrast (Minimum)](https://www.w3.org/TR/WCAG/#contrast-minimum) |10 | AA | Serious | Elements must meet minimum color contrast ratio thresholds | https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html |\n| target-size | [2.5.8 Target Size (Minimum)](https://www.w3.org/TR/WCAG/#target-size-minimum) |2 | AA | Serious | All touch targets must be 24px large, or leave sufficient space | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |\n"}'::jsonb,
    '{"estimatedKPILift": 0}'::jsonb,
    'NEW'::suggestion_status,
    '2025-04-08T14:27:53.758Z'::timestamptz,
    '2025-04-08T14:27:53.758Z'::timestamptz,
    'system'
);
INSERT INTO suggestions (id, opportunity_id, type, rank, data, kpi_deltas, status, created_at, updated_at, updated_by) VALUES (
    '1387b1a6-2d48-4503-9ed6-7939c5b27599',
    '0be4cab5-ee72-428f-b936-ef213c31d2c2',
    'CONTENT_UPDATE'::suggestion_type,
    1,
    '{"recommendations": [{"pageUrl": null, "id": "d8a38fe0-fa68-46ad-805f-671ad18ec9ae", "altText": null, "imageUrl": null}], "suggestionValue": "### Enhancing accessibility for the top 10 most-visited pages\n\n| Issue | WCAG Success Criterion | Level| Pages |Description| How is the user affected | Suggestion | Solution Example |\n|-------|-------|-------------|-------------|-------------|-------------|-------------|-------------|\n| aria-required-parent | [1.3.1 Info and Relationships](https://www.w3.org/TR/WCAG/#info-and-relationships) | A | https://www.tenant-alphaland.com/reeses (11), https://www.tenant-alphaland.com/tenant-alphas (8), https://www.tenant-alphaland.com/reeses/chocolate-lava.html (5), https://www.tenant-alphaland.com/jolly-rancher (8), https://www.tenant-alphaland.com/ice-breakers (6), https://www.tenant-alphaland.com/kisses (8), https://www.tenant-alphaland.com/dots-pretzels (9), https://www.tenant-alphaland.com/kit-kat (6), https://www.tenant-alphaland.com/skinnypop (9) | Certain ARIA roles must be contained by particular parents | Screen reader users receive incomplete or incorrect information about content organization. When elements require specific parent roles but don''t have them, the hierarchical relationship is broken, making navigation confusing and unpredictable. | Add `role=\"group\"` or `role=\"listbox\"` attribute to parents of elements with `role=\"option\"` attribute. | Update from `<div class=\"my-slider text-container_slider containerID-slider-384078991 itemtoshow3 product-slider tns-slider tns-carousel tns-subpixel tns-calc tns-horizontal\" id=\"tns1\"><div class=\"cmp-product-slider__item removeBG tns-item tns-slide-active\" id=\"tns1-item0\" role=\"option\">` to `<div class=\"my-slider text-container_slider containerID-slider-384078991 itemtoshow3 product-slider tns-slider tns-carousel tns-subpixel tns-calc tns-horizontal\" id=\"tns1\" role=\"listbox\"><div class=\"cmp-product-slider__item removeBG tns-item tns-slide-active\" id=\"tns1-item0\" role=\"option\">` |\n| nested-interactive | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) | A | https://www.tenant-alphaland.com/reeses (10), https://www.tenant-alphaland.com/tenant-alphas (6), https://www.tenant-alphaland.com/reeses/chocolate-lava.html (6), https://www.tenant-alphaland.com/jolly-rancher (7), https://www.tenant-alphaland.com/ice-breakers (4), https://www.tenant-alphaland.com/kisses (6), https://www.tenant-alphaland.com/dots-pretzels (8), https://www.tenant-alphaland.com/kit-kat (4), https://www.tenant-alphaland.com/skinnypop (8) | Interactive controls must not be nested | Screen reader and keyboard users face accessibility barriers when interactive controls are nested within other interactive elements. This creates unpredictable behavior, incomplete announcements, and potentially unusable features that trap or skip focus. | Remove tabindex=\"-1\". | Update from `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" tabindex=\"-1\" role=\"option\">` to `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" role=\"option\">` |\n| aria-required-attr | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) | A | https://www.tenant-alphaland.com/reeses (5), https://www.tenant-alphaland.com/tenant-alphas (3), https://www.tenant-alphaland.com/reeses/chocolate-lava.html (1), https://www.tenant-alphaland.com/jolly-rancher (3), https://www.tenant-alphaland.com/ice-breakers (2), https://www.tenant-alphaland.com/kisses (2), https://www.tenant-alphaland.com/dots-pretzels (3), https://www.tenant-alphaland.com/kit-kat (2), https://www.tenant-alphaland.com/skinnypop (3) | Required ARIA attributes must be provided | Screen reader users receive incomplete information about an element''s purpose or state when required ARIA attributes are missing. This prevents users from understanding how to interact with elements or their current state. | Add `aria-level` attribute to elements that are used as headings. | Update from `<span role=\"heading\" class=\"h6\">HERSHEY BRANDS</span>` to `<span role=\"heading\" class=\"h6\" aria-level=\"6\">HERSHEY BRANDS</span>` |\n| aria-hidden-focus | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) | A | https://www.tenant-alphaland.com/reeses (13), https://www.tenant-alphaland.com/tenant-alphas (12), https://www.tenant-alphaland.com/jolly-rancher (12), https://www.tenant-alphaland.com/ice-breakers (12), https://www.tenant-alphaland.com/kisses (12), https://www.tenant-alphaland.com/dots-pretzels (12), https://www.tenant-alphaland.com/kit-kat (12), https://www.tenant-alphaland.com/skinnypop (24) | ARIA hidden element must not be focusable or contain focusable elements | Keyboard and screen reader users experience confusing interfaces when elements hidden from screen readers (aria-hidden=\"true\") remain focusable. Users can focus on elements they cannot perceive, creating a disconnected experience where their cursor appears to \"disappear\". | Remove `aria-hidden=\"true\"` from elements that contain focusable elements, or ensure all focusable elements within hidden containers also have tabindex=\"-1\". | Update from `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" tabindex=\"-1\" role=\"option\"><div class=\"cmp-product-slider__content\"><div class=\"cmp-product-slider__image\"><a href=\"/products/reeses-milk-chocolate-snack-size-peanut-butter-cups-10-5-oz-bag.html\">...</a></div></div></div>` to `<div class=\"cmp-product-slider__item removeBG tns-item\" aria-hidden=\"true\" tabindex=\"-1\" role=\"option\"><div class=\"cmp-product-slider__content\"><div class=\"cmp-product-slider__image\"><a href=\"/products/reeses-milk-chocolate-snack-size-peanut-butter-cups-10-5-oz-bag.html\" tabindex=\"-1\">...</a></div></div></div>` |\n| aria-allowed-attr | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) | A | https://www.tenant-alphaland.com/reeses (8), https://www.tenant-alphaland.com/tenant-alphas (6), https://www.tenant-alphaland.com/jolly-rancher (4), https://www.tenant-alphaland.com/ice-breakers (6), https://www.tenant-alphaland.com/kisses (10), https://www.tenant-alphaland.com/dots-pretzels (6), https://www.tenant-alphaland.com/kit-kat (6), https://www.tenant-alphaland.com/skinnypop (4) | Elements must only use supported ARIA attributes | Screen reader users receive misleading or nonsensical information when elements use ARIA attributes they don''t support. This causes confusion when the announced content doesn''t match the expected behavior of the element. | Remove `aria-level` attribute from the HTML elements that do not support it. | Remove `aria-level` attribute from the HTML elements that do not support it. | Update from `<dt aria-level=\"3\">` to `<dt>` |\n| aria-input-field-name | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) | A | https://www.tenant-alphaland.com/reeses/chocolate-lava.html (1) | ARIA input fields must have an accessible name | Screen reader users cannot identify the purpose of input fields without accessible names. When encountering unnamed fields, users must guess their purpose, making forms difficult or impossible to complete accurately. | Add descriptive text content to the element with `id=\"sliderLabel\"` if it exists, or add `aria-label` attribute if no visible label element exists. Ensure the label clearly describes the slider''s purpose. | Update from `<div class=\"cmp-slider padfromright product \" animation-apply=\"false\" animation-direction=\"default\" animation-direction-mobile=\"left\" animation-speed=\".2\" parallax-speed=\"10\" parallax-apply=\"false\" animation-distance=\"200px\" aria-labelledby=\"sliderLabel\" role=\"slider\">` to `<div class=\"cmp-slider padfromright product \" animation-apply=\"false\" animation-direction=\"default\" animation-direction-mobile=\"left\" animation-speed=\".2\" parallax-speed=\"10\" parallax-apply=\"false\" animation-distance=\"200px\" aria-label=\"Product Slider\" role=\"slider\">`|\n\n---"}'::jsonb,
    '{"estimatedKPILift": 0}'::jsonb,
    'NEW'::suggestion_status,
    '2025-04-08T14:28:09.417Z'::timestamptz,
    '2025-04-08T14:28:09.417Z'::timestamptz,
    'system'
);
INSERT INTO suggestions (id, opportunity_id, type, rank, data, kpi_deltas, status, created_at, updated_at, updated_by) VALUES (
    '57185e42-4555-4b35-bc4f-376df13aeaf6',
    '457316da-a35b-4c77-a096-92204e27d261',
    'CODE_CHANGE'::suggestion_type,
    1,
    '{"suggestionValue": "\n### Accessibility Issues Overview\n\n| Issue | WCAG Success Criterion | Count| Level |Impact| Description | WCAG Docs Link |\n|-------|-------|-------------|-------------|-------------|-------------|-------------|\n| aria-allowed-attr | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) |123 | A | Critical | Elements must only use supported ARIA attributes | https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html |\n| nested-interactive | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) |98 | A | Serious | Interactive controls must not be nested | https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html |\n| aria-required-attr | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) |93 | A | Critical | Required ARIA attributes must be provided | https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html |\n| aria-required-parent | [1.3.1 Info and Relationships](https://www.w3.org/TR/WCAG/#info-and-relationships) |6 | A | Critical | Certain ARIA roles must be contained by particular parents | https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html |\n| aria-input-field-name | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) |6 | A | Serious | ARIA input fields must have an accessible name | https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html |\n| label | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) |3 | A |  | Form elements must have labels | https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html |\n| aria-required-children | [1.3.1 Info and Relationships](https://www.w3.org/TR/WCAG/#info-and-relationships) |1 | A | Critical | Certain ARIA roles must contain particular children | https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html |\n| color-contrast | [1.4.3 Contrast (Minimum)](https://www.w3.org/TR/WCAG/#contrast-minimum) |46 | AA | Serious | Elements must meet minimum color contrast ratio thresholds | https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html |\n\n---\n\n"}'::jsonb,
    NULL::jsonb,
    'NEW'::suggestion_status,
    '2025-08-07T12:56:43.332Z'::timestamptz,
    '2025-08-07T12:56:43.334Z'::timestamptz,
    'system'
);
INSERT INTO suggestions (id, opportunity_id, type, rank, data, kpi_deltas, status, created_at, updated_at, updated_by) VALUES (
    '76d6a876-f10a-446d-badf-410a40fb0e79',
    '8eac64fc-6cbd-446c-a013-3b6673c45ec8',
    'CODE_CHANGE'::suggestion_type,
    1,
    '{"suggestionValue": "### Enhancing accessibility for the top 10 most-visited pages\n\n| Issue | WCAG Success Criterion | Level| Pages |Description| How is the user affected | Suggestion | Solution Example |\n|-------|-------|-------------|-------------|-------------|-------------|-------------|-------------|\n| aria-required-attr | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) | A | https://www.tenant-alpha-secondary.com/ (2), https://www.tenant-alpha-secondary.com/things-to-do/reeses-stuff-your-cup.html (2), https://www.tenant-alpha-secondary.com/plan-your-visit.html (2), https://www.tenant-alpha-secondary.com/locations/times-square.html (2), https://www.tenant-alpha-secondary.com/things-to-do/tenant-alphas-chocolate-tour.html (3), https://www.tenant-alpha-secondary.com/store.html (5), https://www.tenant-alpha-secondary.com/things-to-do/create-your-own-candy-bar.html (1), https://www.tenant-alpha-secondary.com/things-to-do.html (1) | Required ARIA attributes must be provided | Screen reader users receive incomplete information about an element''s purpose or state when required ARIA attributes are missing. This prevents users from understanding how to interact with elements or their current state. | Add `aria-level` attribute to elements that are used as headings. | One or more of the following related issues may also be present:<br>1. Required ARIA attribute not present: aria-level |\n| aria-allowed-attr | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) | A | https://www.tenant-alpha-secondary.com/plan-your-visit.html (4), https://www.tenant-alpha-secondary.com/things-to-do/tenant-alphas-chocolate-tour.html (2), https://www.tenant-alpha-secondary.com/store.html (6), https://www.tenant-alpha-secondary.com/things-to-do/create-your-own-candy-bar.html (2), https://www.tenant-alpha-secondary.com/things-to-do.html (1) | Elements must only use supported ARIA attributes | Screen reader users receive misleading or nonsensical information when elements use ARIA attributes they don''t support. This causes confusion when the announced content doesn''t match the expected behavior of the element. | Remove `aria-level` attribute from the HTML elements that do not support it. | The following issue has been identified and must be addressed:<br>1. ARIA attribute is not allowed: aria-level=\"3\" |\n| aria-required-parent | [1.3.1 Info and Relationships](https://www.w3.org/TR/WCAG/#info-and-relationships) | A | https://www.tenant-alpha-secondary.com/things-to-do.html (6) | Certain ARIA roles must be contained by particular parents | Screen reader users receive incomplete or incorrect information about content organization. When elements require specific parent roles but don''t have them, the hierarchical relationship is broken, making navigation confusing and unpredictable. | Add `role=\"group\"` or `role=\"listbox\"` attribute to parents of elements with `role=\"option\"` attribute. | One or more of the following related issues may also be present:<br>1. Required ARIA parent role not present: tablist |\n| aria-required-children | [1.3.1 Info and Relationships](https://www.w3.org/TR/WCAG/#info-and-relationships) | A | https://www.tenant-alpha-secondary.com/things-to-do.html (1) | Certain ARIA roles must contain particular children | Screen reader users receive incomplete information about content structure when ARIA roles requiring specific children lack those children. This breaks expected relationships and makes navigation unpredictable. | Ensure elements with aria-controls attribute has a parent with role like \"group\". | One or more of the following related issues may also be present:<br>1. Element has children which are not allowed: [role=presentation] |\n| nested-interactive | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) | AA | https://www.tenant-alpha-secondary.com/ (1), https://www.tenant-alpha-secondary.com/things-to-do/reeses-stuff-your-cup.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit.html (1), https://www.tenant-alpha-secondary.com/things-to-do/tenant-alphas-chocolate-tour.html (1), https://www.tenant-alpha-secondary.com/store.html (1), https://www.tenant-alpha-secondary.com/things-to-do/reeses-stuff-your-cup-ingredients.html (1), https://www.tenant-alpha-secondary.com/things-to-do/create-your-own-candy-bar.html (1), https://www.tenant-alpha-secondary.com/things-to-do.html (7), https://www.tenant-alpha-secondary.com/blog/reeses-brand.html (1) | Interactive controls must not be nested | Screen reader and keyboard users face accessibility barriers when interactive controls are nested within other interactive elements. This creates unpredictable behavior, incomplete announcements, and potentially unusable features that trap or skip focus. | Remove tabindex=\"-1\". | One or more of the following related issues may also be present:<br>1. Element has focusable descendants |\n| color-contrast | [1.4.3 Contrast (Minimum)](https://www.w3.org/TR/WCAG/#contrast-minimum) | AA | https://www.tenant-alpha-secondary.com/plan-your-visit.html (6), https://www.tenant-alpha-secondary.com/things-to-do.html (1) | Elements must meet minimum color contrast ratio thresholds | Users with low vision, color blindness, or those in high-glare environments struggle to read text with insufficient contrast. This causes eye strain and can make content completely unreadable for some users. | Increase the contrast between the button text and background colors. Ensure a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text (at least 18pt or 14pt bold). | One or more of the following related issues may also be present:<br>1. Element has insufficient color contrast of 1.34 (foreground color: #cfcfcf, background color: #ebefeb, font size: 10.9pt (14.5px), font weight: normal). Expected contrast ratio of 4.5:1 |\n| aria-input-field-name | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG/#name-role-value) | AA | https://www.tenant-alpha-secondary.com/store.html (1) | ARIA input fields must have an accessible name | Screen reader users cannot identify the purpose of input fields without accessible names. When encountering unnamed fields, users must guess their purpose, making forms difficult or impossible to complete accurately. | Add `aria-label` attribute to sliders. | One or more of the following related issues may also be present:<br>1. aria-label attribute does not exist or is empty<br>2. aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty<br>3. Element has no title attribute |\n\n---\n\n### Quick Wins Pages Per Issue\n\nBelow is a detailed breakdown of all pages affected by each quick win issue.\n\n| Issue | Pages |\n|--------|--------|\n| Elements must only use supported ARIA attributes | https://www.tenant-alpha-secondary.com/plan-your-visit.html (4), https://www.tenant-alpha-secondary.com/plan-your-visit/the-tenant-alpha-area.html (1), https://www.tenant-alpha-secondary.com/store.html (6), https://www.tenant-alpha-secondary.com/things-to-do/create-your-own-candy-bar.html (2), https://www.tenant-alpha-secondary.com/things-to-do/tenant-alphas-chocolate-tour.html (2), https://www.tenant-alpha-secondary.com/things-to-do.html (1), https://www.tenant-alpha-secondary.com/tickets.html (10), https://www.tenant-alpha-secondary.com/home/faqs.html (33), https://www.tenant-alpha-secondary.com/plan-your-visit/directions-and-parking.html (9), https://www.tenant-alpha-secondary.com/sweets-and-eats/food-hall.html (1), https://www.tenant-alpha-secondary.com/sweets-and-eats.html (3), https://www.tenant-alpha-secondary.com/things-to-do/tenant-alpha-trolley-works.html (2), https://www.tenant-alpha-secondary.com/things-to-do/tenant-alphas-unwrapped.html (1), https://www.tenant-alpha-secondary.com/faqs.html (33), https://www.tenant-alpha-secondary.com/plan-your-visit/groups-and-parties.html (4), https://www.tenant-alpha-secondary.com/plan-your-visit/amenities-and-accessibility.html (11) |\n| Interactive controls must not be nested | https://www.tenant-alpha-secondary.com/ (1), https://www.tenant-alpha-secondary.com/blog/reeses-brand.html (1), https://www.tenant-alpha-secondary.com/blog/reeses-direct-factory.html (1), https://www.tenant-alpha-secondary.com/locations.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit/hours.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit/the-tenant-alpha-area.html (1), https://www.tenant-alpha-secondary.com/store.html (1), https://www.tenant-alpha-secondary.com/sweets-and-eats/menu.html (1), https://www.tenant-alpha-secondary.com/things-to-do/create-your-own-candy-bar.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/reeses-pep-rally.html (1), https://www.tenant-alpha-secondary.com/things-to-do/tenant-alphas-chocolate-tour.html (1), https://www.tenant-alpha-secondary.com/things-to-do.html (7), https://www.tenant-alpha-secondary.com/things-to-do/reeses-stuff-your-cup-ingredients.html (1), https://www.tenant-alpha-secondary.com/things-to-do/reeses-stuff-your-cup.html (1), https://www.tenant-alpha-secondary.com/tickets.html (1), https://www.tenant-alpha-secondary.com/blog/kisses-brand.html (1), https://www.tenant-alpha-secondary.com/blog/worlds-largest-tenant-alphas-store.html (1), https://www.tenant-alpha-secondary.com/home/faqs.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit/directions-and-parking.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit/groups-and-parties/birthday-parties.html (1), https://www.tenant-alpha-secondary.com/sweets-and-eats/bakery.html (2), https://www.tenant-alpha-secondary.com/sweets-and-eats/food-hall.html (1), https://www.tenant-alpha-secondary.com/sweets-and-eats.html (1), https://www.tenant-alpha-secondary.com/sweets-and-eats/milkshakes-and-ice-cream.html (1), https://www.tenant-alpha-secondary.com/sweets-and-eats/smores.html (1), https://www.tenant-alpha-secondary.com/things-to-do/create-your-own-candy-bar-ingredients.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/breakfast-with-santa.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/tenant-alphas-character-appearances.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/photos-with-santa.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/photos-with-the-easter-bunny.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/reeses-shapes.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/sweet-lights-trolley.html (1), https://www.tenant-alpha-secondary.com/things-to-do/great-candy-expedition.html (1), https://www.tenant-alpha-secondary.com/things-to-do/tenant-alpha-trolley-works.html (1), https://www.tenant-alpha-secondary.com/things-to-do/tenant-alphas-unwrapped.html (1), https://www.tenant-alpha-secondary.com/blog/free-fun.html (1), https://www.tenant-alpha-secondary.com/blog/great-candy-expedition-announcement.html (1), https://www.tenant-alpha-secondary.com/blog/personalized-experiences.html (1), https://www.tenant-alpha-secondary.com/blog/planning-your-visit-to-tenant-alpha-pa.html (1), https://www.tenant-alpha-secondary.com/blog/toys-games.html (1), https://www.tenant-alpha-secondary.com/contact-us.html (1), https://www.tenant-alpha-secondary.com/faqs.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit/groups-and-parties/groups.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit/groups-and-parties.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/breakfast-with-reester-bunny.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/chocolate-wine-pairing.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/tenant-alphas-holiday-chocolate-house.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/tenant-alphas-illumination.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/holly-jolly-trolley.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/new-years-eve.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/trick-or-treat-trail.html (1), https://www.tenant-alpha-secondary.com/things-to-do/tenant-alphas-unwrapped-ingredients.html (1), https://www.tenant-alpha-secondary.com/blog/4d-movie-closure.html (1), https://www.tenant-alpha-secondary.com/blog/50th-anniversary-scrapbook.html (1), https://www.tenant-alpha-secondary.com/blog/all-things-reeses.html (1), https://www.tenant-alpha-secondary.com/blog/chocolate-meltdown.html (1), https://www.tenant-alpha-secondary.com/blog/holiday-preview.html (1), https://www.tenant-alpha-secondary.com/blog/jollyrancher-twizzler-roundup.html (1), https://www.tenant-alpha-secondary.com/blog/mothers-day.html (1), https://www.tenant-alpha-secondary.com/blog/visiting-tips.html (3), https://www.tenant-alpha-secondary.com/contact-us/submit-a-question.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit/amenities-and-accessibility.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit/groups-and-parties/private-events-and-meetings.html (3), https://www.tenant-alpha-secondary.com/things-to-do/50-years-of-fun.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/cupcake.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/dots-pretzels.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/julia-gash.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/santa-arrival.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/sensory-friendly-night.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/snoopy.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/trick-or-treat-trolley.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/veterans-day.html (1), https://www.tenant-alpha-secondary.com/blog/employment-perks.html (1), https://www.tenant-alpha-secondary.com/blog/halloween-preview.html (1), https://www.tenant-alpha-secondary.com/blog/tenant-alphas-brand.html (1), https://www.tenant-alpha-secondary.com/blog/reeses-caramel.html (1), https://www.tenant-alpha-secondary.com/content/tenant-alphaland/en-us/home/recipes-and-crafts/recipes/easy-cinnamon-chip-scones.html?bvstate=pg:2/ct:r (1), https://www.tenant-alpha-secondary.com/things-to-do/events/bean-to-bar-celebration.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/birthday-celebration.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/chocolate-sculpture.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/cookies-cheer.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/decorate-with-mrs-claus.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/lunar-new-year.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/reeses-pretzels.html (1), https://www.tenant-alpha-secondary.com/things-to-do/great-candy-expedition-ingredients.html (1) |\n| Required ARIA attributes must be provided | https://www.tenant-alpha-secondary.com/ (2), https://www.tenant-alpha-secondary.com/locations.html (1), https://www.tenant-alpha-secondary.com/locations/las-vegas.html (1), https://www.tenant-alpha-secondary.com/locations/niagara-falls.html (2), https://www.tenant-alpha-secondary.com/locations/times-square.html (2), https://www.tenant-alpha-secondary.com/plan-your-visit.html (2), https://www.tenant-alpha-secondary.com/plan-your-visit/the-tenant-alpha-area.html (2), https://www.tenant-alpha-secondary.com/store.html (5), https://www.tenant-alpha-secondary.com/sweets-and-eats/menu.html (1), https://www.tenant-alpha-secondary.com/things-to-do/create-your-own-candy-bar.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/reeses-pep-rally.html (1), https://www.tenant-alpha-secondary.com/things-to-do/tenant-alphas-chocolate-tour.html (3), https://www.tenant-alpha-secondary.com/things-to-do.html (1), https://www.tenant-alpha-secondary.com/things-to-do/reeses-stuff-your-cup.html (2), https://www.tenant-alpha-secondary.com/plan-your-visit/directions-and-parking.html (2), https://www.tenant-alpha-secondary.com/sweets-and-eats/bakery.html (3), https://www.tenant-alpha-secondary.com/sweets-and-eats.html (1), https://www.tenant-alpha-secondary.com/sweets-and-eats/milkshakes-and-ice-cream.html (1), https://www.tenant-alpha-secondary.com/sweets-and-eats/smores.html (2), https://www.tenant-alpha-secondary.com/things-to-do/events/breakfast-with-santa.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/tenant-alphas-character-appearances.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/photos-with-santa.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/photos-with-the-easter-bunny.html (2), https://www.tenant-alpha-secondary.com/things-to-do/events/reeses-shapes.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/sweet-lights-trolley.html (1), https://www.tenant-alpha-secondary.com/things-to-do/great-candy-expedition.html (1), https://www.tenant-alpha-secondary.com/things-to-do/tenant-alpha-trolley-works.html (1), https://www.tenant-alpha-secondary.com/things-to-do/tenant-alphas-unwrapped.html (1), https://www.tenant-alpha-secondary.com/blog/free-fun.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit/groups-and-parties/groups.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit/groups-and-parties.html (2), https://www.tenant-alpha-secondary.com/things-to-do/events/breakfast-with-reester-bunny.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/chocolate-wine-pairing.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/tenant-alphas-illumination.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/holly-jolly-trolley.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/new-years-eve.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/trick-or-treat-trail.html (1), https://www.tenant-alpha-secondary.com/blog/all-things-reeses.html (1), https://www.tenant-alpha-secondary.com/blog/holiday-preview.html (4), https://www.tenant-alpha-secondary.com/blog/mothers-day.html (4), https://www.tenant-alpha-secondary.com/blog/visiting-tips.html (6), https://www.tenant-alpha-secondary.com/plan-your-visit/groups-and-parties/private-events-and-meetings.html (3), https://www.tenant-alpha-secondary.com/things-to-do/events/cupcake.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/dots-pretzels.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/julia-gash.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/santa-arrival.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/sensory-friendly-night.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/snoopy.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/trick-or-treat-trolley.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/veterans-day.html (1), https://www.tenant-alpha-secondary.com/blog/halloween-preview.html (3), https://www.tenant-alpha-secondary.com/blog/reeses-caramel.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/bean-to-bar-celebration.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/birthday-celebration.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/chocolate-sculpture.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/cookies-cheer.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/decorate-with-mrs-claus.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/lunar-new-year.html (1), https://www.tenant-alpha-secondary.com/things-to-do/events/reeses-pretzels.html (1) |\n| Elements must meet minimum color contrast ratio thresholds | https://www.tenant-alpha-secondary.com/locations/niagara-falls.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit/hours.html (6), https://www.tenant-alpha-secondary.com/plan-your-visit.html (6), https://www.tenant-alpha-secondary.com/things-to-do.html (1), https://www.tenant-alpha-secondary.com/plan-your-visit/groups-and-parties.html (6), https://www.tenant-alpha-secondary.com/things-to-do/events/tenant-alphas-holiday-chocolate-house.html (5), https://www.tenant-alpha-secondary.com/things-to-do/50-years-of-fun.html (16), https://www.tenant-alpha-secondary.com/things-to-do/events/trick-or-treat-trolley.html (1), https://www.tenant-alpha-secondary.com/blog/halloween-preview.html (4) |\n| Certain ARIA roles must be contained by particular parents | https://www.tenant-alpha-secondary.com/things-to-do.html (6) |\n| ARIA input fields must have an accessible name | https://www.tenant-alpha-secondary.com/store.html (1), https://www.tenant-alpha-secondary.com/sweets-and-eats/bakery.html (1), https://www.tenant-alpha-secondary.com/blog/visiting-tips.html (2), https://www.tenant-alpha-secondary.com/plan-your-visit/groups-and-parties/private-events-and-meetings.html (2) |\n| Form elements must have labels | https://www.tenant-alpha-secondary.com/plan-your-visit/groups-and-parties/birthday-parties.html (3) |\n| Certain ARIA roles must contain particular children | https://www.tenant-alpha-secondary.com/things-to-do.html (1) |\n\n---\n\n"}'::jsonb,
    NULL::jsonb,
    'NEW'::suggestion_status,
    '2025-08-07T12:56:43.384Z'::timestamptz,
    '2025-08-07T12:56:43.385Z'::timestamptz,
    'system'
);

-- Site Top Pages
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'd14045b1-136d-4a47-884b-e684b94b7f98',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/recipes/easy-tenant-alphas-bar-pie.html',
    1000,
    'ahrefs',
    'tenant-alpha bar pie',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.028Z'::timestamptz,
    '2026-01-31T06:19:47.028Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '498444a9-9666-4dfc-ac48-fd1bcbf9bd5e',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/reeses-zero-sugar-miniatures-chocolate-candy-peanut-butter-cups-5-1-oz-bag.html',
    1011,
    'ahrefs',
    'reeses cups',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.027Z'::timestamptz,
    '2026-01-31T06:19:47.028Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '61c4b311-5d87-4408-bf39-c798de4191d3',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/cookies-n-creme',
    1016,
    'ahrefs',
    'tenant-alpha cookies and cream',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.027Z'::timestamptz,
    '2026-01-31T06:19:47.027Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '57c3ce34-476e-49b1-9c41-2783cfc52577',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/reeses-milk-chocolate-peanut-butter-mini-pumpkins-7-6-oz-bag.html',
    1030,
    'ahrefs',
    'reese''s mini pumpkins',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.027Z'::timestamptz,
    '2026-01-31T06:19:47.027Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '7ea1fca0-042f-4aad-9294-4dbbdfef0486',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/cadbury-caramello-milk-chocolate-and-creamy-caramel-candy-bar-1-6-oz.html',
    1031,
    'ahrefs',
    'cadbury caramello',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.026Z'::timestamptz,
    '2026-01-31T06:19:47.027Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '18706c66-b777-4593-a7d6-1a8263cf8777',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/recipes/simple-chocolate-coating.html',
    1038,
    'ahrefs',
    'chocolate coating',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.026Z'::timestamptz,
    '2026-01-31T06:19:47.026Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'c14e754a-3f2d-4564-84a7-7644ab7a7fb2',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/reeses-plant-based-oat-chocolate-confection-and-peanut-butter-cups-1-4-oz.html',
    1044,
    'ahrefs',
    'reese''s plant based',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.026Z'::timestamptz,
    '2026-01-31T06:19:47.026Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'ad14c867-3c49-493c-8fcd-3123a39cc24d',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/kit-kat-milk-chocolate-snack-size-candy-bars-3-92-oz-8-pack.html',
    1055,
    'ahrefs',
    'snack size kit kat calories',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.025Z'::timestamptz,
    '2026-01-31T06:19:47.026Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '7fc2af8e-f60e-4317-9e94-8ab60ee216e5',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/reeses-big-cup-with-potato-chips-peanut-butter-cup-1-3-oz.html',
    1060,
    'ahrefs',
    'potato chip reese''s',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.025Z'::timestamptz,
    '2026-01-31T06:19:47.025Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'b3b760a9-3807-4c05-8efb-cbc38af1590f',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/brookside',
    10800,
    'ahrefs',
    'brookside chocolate',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:46.998Z'::timestamptz,
    '2026-01-31T06:19:46.998Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'a658a08f-3771-4cf9-bcad-a9e335fbe5f5',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/stories/how-to-make-a-diy-candy-flower-bouquet.html',
    1085,
    'ahrefs',
    'diy candy bouquet',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.025Z'::timestamptz,
    '2026-01-31T06:19:47.025Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'cd709085-d943-4e36-9cc8-9cde73be0a29',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/ice-breakers-ice-cubes-peppermint-sugar-free-gum-3-24-oz-bottle-40-pieces.html',
    1095,
    'ahrefs',
    'ice cubes gum',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.025Z'::timestamptz,
    '2026-01-31T06:19:47.025Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'def07a0f-d479-4cb1-8556-8e1c1977bcd2',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/reeses-sticks-chocolate-peanut-butter-candy-bar-1-5-oz.html',
    1121,
    'ahrefs',
    'reese''s sticks',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.024Z'::timestamptz,
    '2026-01-31T06:19:47.024Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '5a36cd4e-92b5-4762-93ed-f00494497a80',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/recipes/classic-chocolate-cream-pie.html',
    1141,
    'ahrefs',
    'tenant-alpha''s chocolate pie',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.024Z'::timestamptz,
    '2026-01-31T06:19:47.024Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '5826af59-4170-4e33-95cd-75710301faff',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/tenant-alphas-kisses-grinch-foils-milk-chocolate-candy-9-5-oz-bag.html',
    1147,
    'ahrefs',
    'grinch kisses',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.024Z'::timestamptz,
    '2026-01-31T06:19:47.024Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'abf6d2a6-eee0-42d1-8408-4eaf6e140b9f',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/stories/how-to-make-smores-at-home.html',
    1150,
    'ahrefs',
    'how to make s''mores at home',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.023Z'::timestamptz,
    '2026-01-31T06:19:47.023Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '8bac57c8-76e9-43ad-b24a-7ec68bbb4722',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/heath-chocolatey-english-toffee-bits-8-oz-bag.html',
    1198,
    'ahrefs',
    'heath toffee bits',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.023Z'::timestamptz,
    '2026-01-31T06:19:47.023Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'b0dce6fd-1711-499b-8c0e-c7f3fef695f8',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/about/faqs.html',
    1200,
    'ahrefs',
    'are tenant-alpha kisses gluten free',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.023Z'::timestamptz,
    '2026-01-31T06:19:47.023Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '8360c667-11aa-4404-bb20-077b3ec726cb',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/twizzlers-cherry-hearts-7-1-oz-bag.html',
    1212,
    'ahrefs',
    'twizzler hearts',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.022Z'::timestamptz,
    '2026-01-31T06:19:47.022Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'adb488f3-8d40-449f-b689-5e2f14c3c4e2',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/reeses-creamy-peanut-butter-18-oz-jar.html',
    1228,
    'ahrefs',
    'reeses peanut butter',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.022Z'::timestamptz,
    '2026-01-31T06:19:47.022Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '7e8692ab-4ac1-4105-b5f1-3f3c903a0654',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/stories/diy-easter-basket-ideas-for-adults.html',
    1248,
    'ahrefs',
    'easter gift ideas for adults',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.022Z'::timestamptz,
    '2026-01-31T06:19:47.022Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'b0cac1b9-20a2-477e-b05c-2a239757f36c',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/about/history.html',
    1254,
    'ahrefs',
    'tenant-alpha''s chocolate',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.022Z'::timestamptz,
    '2026-01-31T06:19:47.022Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '1aa4dc2b-c73c-4bfc-8e79-9b0198f2276c',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/',
    12591,
    'ahrefs',
    'tenant-alphaland',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:46.998Z'::timestamptz,
    '2026-01-31T06:19:46.998Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '2d956c16-df2f-441b-97e4-d061cdb33cdd',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/twizzlers-pull-n-peel-cherry-flavored-candy-14-oz-bag.html',
    1260,
    'ahrefs',
    'twizzlers pull and peel',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.021Z'::timestamptz,
    '2026-01-31T06:19:47.021Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '408701e8-9e5e-4d82-a47c-dba76b4367af',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/stories/how-to-melt-chocolate-chips.html',
    1270,
    'ahrefs',
    'how to melt chocolate chips in the microwave',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.021Z'::timestamptz,
    '2026-01-31T06:19:47.021Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'fe8f07b9-a885-4a40-aca9-82db5d9244c0',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/twizzlers',
    12914,
    'ahrefs',
    'twizzler',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:46.997Z'::timestamptz,
    '2026-01-31T06:19:46.997Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '4d2727a1-2a57-4d01-bbed-5f80e7fc3f43',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/heath-chocolatey-english-toffee-candy-bar-1-4-oz.html',
    1299,
    'ahrefs',
    'heath bar ingredients',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.021Z'::timestamptz,
    '2026-01-31T06:19:47.021Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'a7157f77-ed50-4340-8eca-f517f064be1e',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/reeses-outrageous-milk-chocolate-peanut-butter-candy-bar-1-48-oz.html',
    1304,
    'ahrefs',
    'reese outrageous',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.020Z'::timestamptz,
    '2026-01-31T06:19:47.020Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '446e5125-7881-425c-bf33-1c850d7b2044',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/stories/how-to-make-chocolate-milk.html',
    1330,
    'ahrefs',
    'chocolate milk',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.020Z'::timestamptz,
    '2026-01-31T06:19:47.020Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'dfd762fe-6d68-4926-86ba-711282331ba8',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/tenant-alphas-kisses-candy-cane-mint-candy-9-oz-bag.html',
    1333,
    'ahrefs',
    'candy cane kisses',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.020Z'::timestamptz,
    '2026-01-31T06:19:47.020Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '796bf7e1-91e0-4004-a88a-5502388cfcaa',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/recipes/reeses-peanut-butter-cup-cookies.html',
    1333,
    'ahrefs',
    'reeses peanut butter cookies',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.019Z'::timestamptz,
    '2026-01-31T06:19:47.019Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'ad5bc018-9f2f-4b0b-8e06-fca8ae5f2b05',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/twizzlers-twists-strawberry-flavored-candy-16-oz-bag.html',
    1340,
    'ahrefs',
    'strawberry twizzlers',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.019Z'::timestamptz,
    '2026-01-31T06:19:47.019Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '344f9fe3-835f-4991-869d-0901cf48dfbe',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/tenant-alphas-milk-chocolate-snack-size-candy-bars-3-6-oz-8-pack.html',
    1383,
    'ahrefs',
    'calories in tenant-alpha bar mini',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.019Z'::timestamptz,
    '2026-01-31T06:19:47.019Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '511faed7-2109-4cad-875f-17cc4b52c32c',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/barkthins',
    1393,
    'ahrefs',
    'bark thins',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.018Z'::timestamptz,
    '2026-01-31T06:19:47.018Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'aef70ca9-a03d-41e3-b843-c52e55b1fcdd',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/kit-kat',
    14172,
    'ahrefs',
    'kit kat',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:46.997Z'::timestamptz,
    '2026-01-31T06:19:46.997Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'c5a5bda0-f9ce-4c8e-a742-ca1651526e15',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/jolly-rancher-chews-original-flavors-candy-13-oz-bag.html',
    1431,
    'ahrefs',
    'jolly rancher chews',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.018Z'::timestamptz,
    '2026-01-31T06:19:47.018Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '1e27f97f-5f2e-400a-88e0-b01fe0882811',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/reeses-milk-chocolate-peanut-butter-hearts-9-1-oz-bag.html',
    1453,
    'ahrefs',
    'reeses heart',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.018Z'::timestamptz,
    '2026-01-31T06:19:47.018Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'b784ea2e-a2c4-4710-873d-653aca0c6ec0',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/recipes/tenant-alphas-perfectly-chocolate-chocolate-cake.html',
    14633,
    'ahrefs',
    'tenant-alpha chocolate cake recipe',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:46.997Z'::timestamptz,
    '2026-01-31T06:19:46.997Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'a2eed639-8584-431c-a1c7-9a5bb91d5ed4',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/recipes/reeses-chewy-chocolate-cookies-with-peanut-butter-chips.html',
    1476,
    'ahrefs',
    'chocolate peanut butter chip cookies',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.018Z'::timestamptz,
    '2026-01-31T06:19:47.018Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '36cfe217-8a5c-447c-81bd-3ca63e0233de',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/recipes/gluten-free-peanut-butter-blossoms.html',
    1487,
    'ahrefs',
    'gluten free peanut butter blossoms',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.017Z'::timestamptz,
    '2026-01-31T06:19:47.017Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'f0654b24-1612-43e6-b77d-d09610bd13db',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/jolly-rancher-zero-sugar-original-flavors-hard-candy-3-6-oz-bag.html',
    1510,
    'ahrefs',
    'sugar free jolly ranchers',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.017Z'::timestamptz,
    '2026-01-31T06:19:47.017Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '24694acb-e5c8-40c4-8f9d-273dc5ab3305',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/tenant-alphas-kisses-sugar-cookie-white-creme-candy-9-oz-bag.html',
    1524,
    'ahrefs',
    'sugar cookie tenant-alpha kisses',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.017Z'::timestamptz,
    '2026-01-31T06:19:47.017Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'f4a9aef9-1af7-4183-a775-e0b98f7c85d9',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/recipes/black-magic-cake.html',
    1537,
    'ahrefs',
    'black magic cake',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.016Z'::timestamptz,
    '2026-01-31T06:19:47.016Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '0a2685da-34c1-48b3-a58f-00daec8b7b71',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/cadbury-dairy-milk-milk-chocolate-candy-bar-3-5-oz.html',
    1539,
    'ahrefs',
    'cadbury dairy milk chocolate bar',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.016Z'::timestamptz,
    '2026-01-31T06:19:47.016Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '137cf245-cde1-4bbe-a9ec-9f2e71323c7c',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/tenant-alphas-nuggets-assortment-52-oz-bag-145-pieces.html',
    1586,
    'ahrefs',
    'tenant-alpha''s nuggets',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.016Z'::timestamptz,
    '2026-01-31T06:19:47.016Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '5652eeab-6e71-4b5f-bae7-726a8efc9cf9',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/stories/our-7-best-cocoa-powder-recipes.html',
    1629,
    'ahrefs',
    'cocoa powder recipes',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.016Z'::timestamptz,
    '2026-01-31T06:19:47.016Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '48121e30-b378-4439-8961-c3ead4a4f213',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/kisses',
    16679,
    'ahrefs',
    'tenant-alpha kisses',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:46.996Z'::timestamptz,
    '2026-01-31T06:19:46.996Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'ac3c3ed6-3727-402b-84c4-1409ec018aa0',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/recipes/chocolate-peanut-clusters.html',
    1796,
    'ahrefs',
    'peanut clusters recipe',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.015Z'::timestamptz,
    '2026-01-31T06:19:47.015Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '31af3531-2dd8-4cea-9347-0160fccd3bef',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/products/tenant-alphas-cinnamon-chips-10-oz-bag.html',
    1810,
    'ahrefs',
    'tenant-alpha''s cinnamon chips',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.015Z'::timestamptz,
    '2026-01-31T06:19:47.015Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '1e4f31c2-55ef-4137-a2f6-f6382ebcaf61',
    '0983c6da-0dee-45cc-b897-3f1fed6b460b',
    'https://www.tenant-alphaland.com/york',
    1818,
    'ahrefs',
    'york peppermint patty',
    'global',
    '2026-01-31T06:19:46.806Z'::timestamptz,
    '2026-01-31T06:19:47.015Z'::timestamptz,
    '2026-01-31T06:19:47.015Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'f87fec08-243c-469d-a8f3-863092bdde22',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/blog/spring-celebrations.html',
    1,
    'ahrefs',
    'tenant-alpha chocolate world birthday party',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.613Z'::timestamptz,
    '2026-01-31T06:20:58.613Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'a88e60a7-e496-4367-a9b1-f3987c6b2e63',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/content/dam/tenant-alpha-chocolate-world/documents/event-spaces-during-hours.pdf',
    1,
    'ahrefs',
    'chocolate world birthday party',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.613Z'::timestamptz,
    '2026-01-31T06:20:58.613Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '1142284b-c870-440c-ace8-b2018976a4aa',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/blog/nostalgia.html',
    1,
    'ahrefs',
    'when did tenant-alpha chocolate world open',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.613Z'::timestamptz,
    '2026-01-31T06:20:58.613Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '78bf9cbc-8a4d-4468-aa3d-671a1531ec33',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/plan-your-visit/private-events-and-meetings/catering.html',
    1,
    'ahrefs',
    'catering tenant-alpha pa',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.613Z'::timestamptz,
    '2026-01-31T06:20:58.613Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '731755cc-295c-4e72-bbd7-c0cd4839d4b0',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/events/lunar-new-year.html',
    10,
    'ahrefs',
    'lunar new year festivals near me',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.607Z'::timestamptz,
    '2026-01-31T06:20:58.607Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '65d31a7f-5548-4c09-9779-8d30f69c58d7',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/events/chocolate-wine-pairing.html',
    10,
    'ahrefs',
    'wine and chocolate tasting near me',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.607Z'::timestamptz,
    '2026-01-31T06:20:58.607Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'f2fd7130-afee-40fc-9de3-2d3b7f5192db',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do.html',
    1000,
    'ahrefs',
    'tenant-alpha''s chocolate world attraction photos',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.590Z'::timestamptz,
    '2026-01-31T06:20:58.590Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'bb44aeaa-2a1e-4edc-8597-ea0670486470',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/plan-your-visit/virtual-tour.html',
    11,
    'ahrefs',
    'tenant-alpha chocolate world tour',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.607Z'::timestamptz,
    '2026-01-31T06:20:58.607Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'bdee6ade-efd0-47e1-810a-8a5f758f1f7f',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/events/breakfast-with-santa.html',
    111,
    'ahrefs',
    'tenant-alpha breakfast with santa',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.597Z'::timestamptz,
    '2026-01-31T06:20:58.597Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'acd8dbee-a21b-4f89-96b5-0d2325ace03b',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/events/reeses-shapes.html',
    113,
    'ahrefs',
    'reese''s shapes',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.597Z'::timestamptz,
    '2026-01-31T06:20:58.597Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '13d5430c-81db-4cf0-b1b6-4c7e2dc46ba5',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/plan-your-visit/birthday-parties.html',
    113,
    'ahrefs',
    'tenant-alpha park birthday party',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.597Z'::timestamptz,
    '2026-01-31T06:20:58.597Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'd188de26-68b1-4b7f-9ac8-83150686d300',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/blog/kisses-brand.html',
    114,
    'ahrefs',
    'kisses chocolate',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.596Z'::timestamptz,
    '2026-01-31T06:20:58.596Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '6699326b-d834-4a8a-a1cd-e26961ea73d3',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/events/tenant-alphas-character-appearances.html',
    115,
    'ahrefs',
    'tenant-alpha chocolate world characters',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.596Z'::timestamptz,
    '2026-01-31T06:20:58.596Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'b8493d14-f6f8-4af4-b906-2763ec4a275b',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/blog/all-things-reeses.html',
    12,
    'ahrefs',
    'reese''s new candy bar',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.606Z'::timestamptz,
    '2026-01-31T06:20:58.606Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '513e7862-4f94-4f3a-9823-2108be119e2e',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/events/santa-arrival.html',
    13,
    'ahrefs',
    'tenant-alpha chocolate world christmas',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.606Z'::timestamptz,
    '2026-01-31T06:20:58.606Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'c1c1032e-7b2d-4f90-a762-981b9ef024c6',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/sweets-and-eats/food-hall.html',
    136,
    'ahrefs',
    'chocolate world restaurant',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.596Z'::timestamptz,
    '2026-01-31T06:20:58.596Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '485793c0-e14f-47fa-ae8c-bc9a67b7b485',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/plan-your-visit/hours.html',
    1384,
    'ahrefs',
    'tenant-alpha chocolate world hours',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.590Z'::timestamptz,
    '2026-01-31T06:20:58.590Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '709c7c38-b973-4e1f-9a84-6d62afe16a30',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/sweets-and-eats/menu.html',
    1391,
    'ahrefs',
    'tenant-alpha''s chocolate world menu',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.590Z'::timestamptz,
    '2026-01-31T06:20:58.590Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'cec58a7b-73be-42f1-809c-417df93ea6a2',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/content/dam/tenant-alpha-chocolate-world/documents/hcw-map2.pdf',
    14,
    'ahrefs',
    'tenant-alpha chocolate world map',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.606Z'::timestamptz,
    '2026-01-31T06:20:58.606Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '5c2ffab3-96a1-4be5-8ce4-6917bf3ebbea',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/blog/planning-your-visit-to-tenant-alpha-pa.html',
    15,
    'ahrefs',
    'tenant-alpha story museum vs chocolate world',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.605Z'::timestamptz,
    '2026-01-31T06:20:58.605Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '806d0421-ef56-4773-96b9-1ed52c590ebd',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/reeses-stuff-your-cup-ingredients.html',
    1504,
    'ahrefs',
    'reese''s peanut butter',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.590Z'::timestamptz,
    '2026-01-31T06:20:58.590Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'e4be211a-102a-4df9-8ec6-81035d0593b3',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/plan-your-visit.html',
    1527,
    'ahrefs',
    'tenant-alpha chocolate world',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.589Z'::timestamptz,
    '2026-01-31T06:20:58.589Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '1bc31f35-20bc-4fb3-b0fe-11c62592bf38',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/blog/50th-anniversary-scrapbook.html',
    17,
    'ahrefs',
    'when did tenant-alpha''s come out',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.605Z'::timestamptz,
    '2026-01-31T06:20:58.605Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'a86e6353-af2b-4ed5-acc7-af8b4571fce5',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/great-candy-expedition-ingredients.html',
    17,
    'ahrefs',
    'ingredients in tenant-alpha kisses',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.605Z'::timestamptz,
    '2026-01-31T06:20:58.605Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'd1e75cee-58ee-4c63-a5ce-14b1d962194a',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/create-your-own-candy-bar.html',
    1711,
    'ahrefs',
    'tenant-alpha candy bars',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.589Z'::timestamptz,
    '2026-01-31T06:20:58.589Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '3a46e664-4ace-4751-bb9a-acad8f871a67',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/blog/free-fun.html',
    178,
    'ahrefs',
    'is tenant-alpha''s chocolate world free',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.595Z'::timestamptz,
    '2026-01-31T06:20:58.596Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'f785cc1f-5ab7-4fe3-bd1c-a2fd3e4c8669',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/tickets.html',
    1788,
    'ahrefs',
    'tenant-alpha chocolate world ticket price',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.589Z'::timestamptz,
    '2026-01-31T06:20:58.589Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '3c82fae6-83dc-4df8-ae56-c354f3371fed',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/events/reeses-oreo.html',
    184,
    'ahrefs',
    'oreo tenant-alpha',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.595Z'::timestamptz,
    '2026-01-31T06:20:58.595Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '7ac6ec34-02ab-4503-9480-f44471391ff5',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/events/tenant-alphas-holiday-chocolate-house.html',
    19,
    'ahrefs',
    'tenant-alpha holiday',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.605Z'::timestamptz,
    '2026-01-31T06:20:58.605Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '5be8259f-dac1-466f-99cd-38eed4016a9e',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/tenant-alphas-chocolate-tour.html?bvstate=pg:3/ct:r',
    19,
    'ahrefs',
    'tenant-alpha''s chocolate world attraction reviews',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.604Z'::timestamptz,
    '2026-01-31T06:20:58.604Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '9b1537e3-8613-42b9-8caf-99f8e8e82fd9',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/content/tenant-alphaland/en-us/home/products/tenant-alphas-chocolate-syrup-24-oz-bottle.html',
    2,
    'ahrefs',
    'how long is tenant-alpha''s chocolate syrup good for after opening',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.612Z'::timestamptz,
    '2026-01-31T06:20:58.612Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'e2ed651b-5221-4a25-8d1a-24b2d1432415',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/blog/visiting-tips.html',
    2,
    'ahrefs',
    'tenant-alpha chocolate world discount tickets',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.612Z'::timestamptz,
    '2026-01-31T06:20:58.612Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '2416aefd-4bdc-4eb6-9d2b-ca1ecffebed4',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/blog/4d-movie-closure.html',
    20,
    'ahrefs',
    'tenant-alpha 4d movie',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.604Z'::timestamptz,
    '2026-01-31T06:20:58.604Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '87a82d25-a5de-453b-9474-cd464c879534',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/great-candy-expedition.html?bvstate=pg:2/ct:r',
    20,
    'ahrefs',
    'tenant-alpha''s great candy expedition',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.604Z'::timestamptz,
    '2026-01-31T06:20:58.604Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'a8b1ae6f-1671-4e05-99b6-f1b0da6c215d',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/sweets-and-eats.html',
    219,
    'ahrefs',
    'tenant-alpha''s chocolate world menu',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.595Z'::timestamptz,
    '2026-01-31T06:20:58.595Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'fb2452bb-4211-4854-b0b5-51f72f8ba682',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/locations/las-vegas.html',
    2190,
    'ahrefs',
    'tenant-alpha world las vegas',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.588Z'::timestamptz,
    '2026-01-31T06:20:58.588Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'ced0490b-f9f8-4361-b5a4-d13110e4d2da',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/great-candy-expedition.html',
    225,
    'ahrefs',
    'tenant-alpha''s great candy expedition',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.595Z'::timestamptz,
    '2026-01-31T06:20:58.595Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'be825a20-adde-48c9-aab0-60d9e9736c07',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/events/dots-pretzels.html',
    23,
    'ahrefs',
    'tenant-alpha dots',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.604Z'::timestamptz,
    '2026-01-31T06:20:58.604Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '8d2f0a98-9c60-4cca-8873-4f5e1bbc010a',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/sweets-and-eats/smores.html',
    248,
    'ahrefs',
    'tenant-alpha''s s''mores',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.594Z'::timestamptz,
    '2026-01-31T06:20:58.594Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'e41af8fc-8937-488c-aa01-21fbd704487b',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/blog/worlds-largest-tenant-alphas-store.html',
    261,
    'ahrefs',
    'giant tenant-alpha bar',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.594Z'::timestamptz,
    '2026-01-31T06:20:58.594Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'a18fce0b-f22d-4685-a286-cb286f3fc002',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/blog/jungle.html',
    27,
    'ahrefs',
    'where does tenant-alpha get their cocoa',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.603Z'::timestamptz,
    '2026-01-31T06:20:58.603Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'b091e81e-1527-40e8-b28d-8429b36eecd6',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/events/veterans-day.html',
    27,
    'ahrefs',
    'tenant-alpha park military discount',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.603Z'::timestamptz,
    '2026-01-31T06:20:58.603Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'c960c882-ebea-4229-b4ad-edb15dfaf4c9',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/events/new-years-eve.html',
    27,
    'ahrefs',
    'tenant-alpha new years eve',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.603Z'::timestamptz,
    '2026-01-31T06:20:58.603Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '0f906da3-97b1-44d7-bea8-8c815da9c4de',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/plan-your-visit/groups.html',
    27,
    'ahrefs',
    'tenant-alpha park group sales',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.603Z'::timestamptz,
    '2026-01-31T06:20:58.603Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '051b5ef7-48fa-491e-9842-c0d01a23755b',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/store.html',
    2909,
    'ahrefs',
    'tenant-alpha chocolate store',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.588Z'::timestamptz,
    '2026-01-31T06:20:58.588Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '343c9087-24b0-459c-9acd-047f5ddd3c53',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/home/careers.html',
    291,
    'ahrefs',
    'chocolate world jobs',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.594Z'::timestamptz,
    '2026-01-31T06:20:58.594Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '3d7282c0-6a88-483a-808b-fb27caeb17b1',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/blog/halloween-preview.html',
    3,
    'ahrefs',
    'tenant-alpha chocolate halloween candy',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.612Z'::timestamptz,
    '2026-01-31T06:20:58.612Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '4057649e-71b7-48a3-a1cb-e17331747361',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/blog/holiday-house-history.html',
    3,
    'ahrefs',
    'tenant-alpha chocolate house',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.612Z'::timestamptz,
    '2026-01-31T06:20:58.612Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    '7ba23f1c-5c4b-4148-b9fd-726b1341b1a9',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/sweets-and-eats/bakery.html',
    321,
    'ahrefs',
    'tenant-alpha bakery',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.594Z'::timestamptz,
    '2026-01-31T06:20:58.594Z'::timestamptz,
    'system'
);
INSERT INTO site_top_pages (id, site_id, url, traffic, source, top_keyword, geo, imported_at, created_at, updated_at, updated_by) VALUES (
    'ed8189f2-6cfa-4f8a-9d5b-3d84e5800fa2',
    'e12c091c-075b-4c94-aab7-398a04412b5c',
    'https://www.tenant-alpha-secondary.com/things-to-do/tenant-alphas-unwrapped.html',
    336,
    'ahrefs',
    'tenant-alpha''s unwrapped',
    'global',
    '2026-01-31T06:20:58.511Z'::timestamptz,
    '2026-01-31T06:20:58.593Z'::timestamptz,
    '2026-01-31T06:20:58.593Z'::timestamptz,
    'system'
);
