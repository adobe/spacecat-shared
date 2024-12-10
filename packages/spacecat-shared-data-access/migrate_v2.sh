#!/bin/bash

# Define AWS CLI command with local DynamoDB endpoint
AWS_LOCAL_CMD="aws dynamodb --region test-region --endpoint-url http://localhost:8000"
REGION="us-east-1"
AWS_CMD="aws dynamodb --region $REGION"

# Define table names
SITE_TABLE="spacecat-services-sites-dev"
ORGANIZATION_TABLE="spacecat-services-organizations-dev"
CONFIGURATION_TABLE="spacecat-services-configurations-dev"
DATA_TABLE="spacecat-services-data-dev"
EXPERIMENT_TABLE="spacecat-services-experiments-dev"
SITE_CANDIDATE_TABLE="spacecat-services-site-candidates-dev"
TOP_PAGES_TABLE="spacecat-services-site-top-pages-dev"
KEY_EVENTS_TABLE="spacecat-services-key-events-dev"

# Fetch all sites
SITES=$($AWS_CMD scan --table-name $SITE_TABLE)
ORGANIZATIONS=$($AWS_CMD scan --table-name $ORGANIZATION_TABLE)
CONFIGURATIONS=$($AWS_CMD scan --table-name $CONFIGURATION_TABLE)
EXPERIMENTS=$($AWS_CMD scan --table-name $EXPERIMENT_TABLE)
SITE_CANDIDATES=$($AWS_CMD scan --table-name $SITE_CANDIDATE_TABLE)
TOP_PAGES=$($AWS_CMD scan --table-name $TOP_PAGES_TABLE)
KEY_EVENTS=$($AWS_CMD scan --table-name $KEY_EVENTS_TABLE)

# Migrate each site
echo "$SITES" | jq -c '.Items[]' | while read -r site; do
    SITE_ID=$(echo $site | jq -r '.id.S')
    SITE_PK="\$spacecat#siteid_$SITE_ID"
    SITE_SK="\$site_1"
    BASE_URL=$(echo $site | jq -r '.baseURL.S')
    DELIVERY_TYPE=$(echo $site | jq -r '.deliveryType.S')
    GITHUB_URL=$(echo $site | jq -r '.gitHubURL.S')
    ORG_ID=$(echo $site | jq -r '.organizationId.S')
    IS_LIVE=$(echo $site | jq -r '.isLive.BOOL // false')
    IS_LIVE_TOGGLED_AT=$(echo $site | jq -r '.isLiveToggledAt.S // empty')
    CREATED_AT=$(echo $site | jq -r '.createdAt.S')
    UPDATED_AT=$(echo $site | jq -r '.updatedAt.S')
    CONFIG=$(echo $site | jq -r '.config // {"M": {}}')
    HLX_CONFIG=$(echo $site | jq -r '.hlxConfig // {"M": {}}')
    SITE_GSI1PK=$(echo $site | jq -r '.GSI1PK.S')
    SITE_GSI1SK="$SITE_SK_#baseurl_${BASE_URL}"
    SITE_GSI2PK="\$spacecat#organizationId_$ORG_ID"
    SITE_GSI2SK="$SITE_SK#updatedat_$UPDATED_AT"
    SITE_GSI3PK="\$spacecat#deliverytype_$DELIVERY_TYPE"
    SITE_GSI3SK="$SITE_GSI2SK"

 MIGRATED_SITE=$(cat <<EOF
{
    "pk": {"S": "$SITE_PK"},
    "sk": {"S": "$SITE_SK"},
    "siteId": {"S": "$SITE_ID"},
    "baseURL": {"S": "$BASE_URL"},
    "deliveryType": {"S": "$DELIVERY_TYPE"},
    "gitHubURL": {"S": "$GITHUB_URL"},
    "organizationId": {"S": "$ORG_ID"},
    "isLive": {"BOOL": $IS_LIVE},
    "isLiveToggledAt": {"S": "$IS_LIVE_TOGGLED_AT"},
    "gsi1pk": {"S": "$SITE_GSI1PK"},
    "gsi1sk": {"S": "$SITE_GSI1SK"},
    "gsi2pk": {"S": "$SITE_GSI2PK"},
    "gsi2sk": {"S": "$SITE_GSI2SK"},
    "gsi3pk": {"S": "$SITE_GSI3PK"},
    "gsi3sk": {"S": "$SITE_GSI3SK"},
    "createdAt": {"S": "$CREATED_AT"},
    "updatedAt": {"S": "$UPDATED_AT"},
    "hlxConfig": $HLX_CONFIG,
    "config": $CONFIG,
    "__edb_e__": {"S": "Site"},
    "__edb_v__": {"N": "1"}
}
EOF
)
    # Insert migrated site data into the site table

    $AWS_LOCAL_CMD put-item --table-name $DATA_TABLE --item "$MIGRATED_SITE"
done
echo "Migrated sites successfully."

# Migrate each organization
echo "$ORGANIZATIONS" | jq -c '.Items[]' | while read -r org; do
    ORG_ID=$(echo $org | jq -r '.id.S')
    ORGANIZATION_PK="\$spacecat#organizationId_$ORG_ID"
    ORGANIZATION_SK="\$organization_1"
    IMS_ORG_ID=$(echo $org | jq -r '.imsOrgId.S')
    NAME=$(echo $org | jq -r '.name.S')
    ORGANIZATION_GSI1PK=$(echo $org | jq -r '.GSI1PK.S')
    ORGANIZATION_GSI1SK="$ORGANIZATION_SK#imsorgid_${IMS_ORG_ID}"
    CREATED_AT=$(echo $org | jq -r '.createdAt.S')
    UPDATED_AT=$(echo $org | jq -r '.updatedAt.S')
    FULLFILLABLE_ITEMS=$(echo $org | jq -r '.fulfillableItems // {"M": {}}')
    CONFIG=$(echo $org | jq -r '.config // {"M": {}}')
 MIGRATED_ORG=$(cat <<EOF
{
    "organizationId": {"S": "$ORG_ID"},
    "imsOrgId": {"S": "$IMS_ORG_ID"},
    "name": {"S": "$NAME"},
    "gsi1pk": {"S": "$ORGANIZATION_GSI1PK"},
    "gsi1sk": {"S": "$ORGANIZATION_GSI1SK"},
    "pk": {"S": "$ORGANIZATION_PK"},
    "sk": {"S": "$ORGANIZATION_SK"},
    "gsi1pk": {"S": "$ORGANIZATION_GSI1PK"},
    "gsi1sk": {"S": "$ORGANIZATION_GSI1SK"},
    "__edb_e__": {"S": "Organization"},
    "__edb_v__": {"N": "1"},
    "createdAt": {"S": "$CREATED_AT"},
    "updatedAt": {"S": "$UPDATED_AT"},
    "fulfillableItems": $FULLFILLABLE_ITEMS,
    "config": $CONFIG
}

EOF
)

    # Insert migrated organization into the data table
    $AWS_LOCAL_CMD put-item --table-name $DATA_TABLE --item "$MIGRATED_ORG"

done
echo "Migrated organizations successfully."

# Migrate configurations
echo "$CONFIGURATIONS" | jq -c '.Items[]' | while read -r configuration; do
    VERSION=$(echo $configuration | jq -r '.version.N')
    CONFIGURATION_ID=$(uuidgen)
    CONFIGURATION_PK="\$spacecat#configurationId_$CONFIGURATION_ID"
    CONFIGURATION_SK="\$configuration_1"
    CONFIGURATION_GSI1PK="all_configurations"
    CONFIGURATION_GSI1SK="\$configuration_1#version_${VERSION}"
    CREATED_AT=$(echo $configuration | jq -r '.createdAt.S')
    UPDATED_AT=$(echo $configuration | jq -r '.updatedAt.S')
    QUEUES=$(echo $configuration | jq -r '.queues // {"M": {}}')
    JOBS=$(echo $configuration | jq -r '.jobs // {"L": {}}')
    HANDLERS=$(echo $configuration | jq -r '.handlers // {"M": {}}')
    SLACK_ROLES=$(echo $configuration | jq -r '.slackRoles // {"M": {}}')
 MIGRATED_CONFIGURATION=$(cat <<EOF
{
    "configurationId": {"S": "$CONFIGURATION_ID"},
    "gsi1pk": {"S": "$CONFIGURATION_GSI1PK"},
    "pk": {"S": "$CONFIGURATION_PK"},
    "sk": {"S": "$CONFIGURATION_SK"},
    "__edb_e__": {"S": "Configuration"},
    "__edb_v__": {"N": "1"},
    "createdAt": {"S": "$CREATED_AT"},
    "updatedAt": {"S": "$UPDATED_AT"},
    "queues": $QUEUES,
    "jobs": $JOBS,
    "handlers": $HANDLERS,
    "slackRoles": $SLACK_ROLES
}

EOF
)

    # Insert migrated organization into the data table
    $AWS_LOCAL_CMD put-item --table-name $DATA_TABLE --item "$MIGRATED_CONFIGURATION"

done
echo "Migrated configurations successfully."

# Migrate each experiment
echo "$EXPERIMENTS" | jq -c '.Items[]' | while read -r experiment; do
    EXPERIMENT_ID=$(echo "$experiment" | jq -r '.experimentId.S')
    EXP_ID=$(uuidgen)
    SITE_ID=$(echo "$experiment" | jq -r '.siteId.S')
    EXPERIMENT_PK="\$spacecat#experimentId_$EXP_ID"
    EXPERIMENT_SK="\$experiment_1"
    EXPERIMENTS_GSI1PK="\$spacecat#siteid_$SITE_ID"
    EXPERIMENT_GSI1SK="$EXPERIMENT_SK#exp_id_${EXP_ID}#url_${URL}#updatedAt_${UPDATED_AT}"
    START_DATE=$(echo "$experiment" | jq -r '.startDate.S')
    STATUS=$(echo "$experiment" | jq -r '.status.S')
    TYPE=$(echo "$experiment" | jq -r '.type.S')
    END_DATE=$(echo "$experiment" | jq -r '.endDate.S')
    URL=$(echo "$experiment" | jq -r '.url.S')
    VARIANTS=$(echo "$experiment" | jq -r '.variants // {"L": []}')
    NAME=$(echo "$experiment" | jq -r '.name.S')
    CONVERSION_EVENT_NAME=$(echo "$experiment" | jq -r '.conversionEventName // empty')
    CONVERSION_EVENT_VALUE=$(echo "$experiment" | jq -r '.conversionEventValue // empty')
    CREATED_AT=$(echo "$experiment" | jq -r '.createdAt.S')
    UPDATED_AT=$(echo "$experiment" | jq -r '.updatedAt.S')
    UPDATED_BY=$(echo "$experiment" | jq -r '.updatedBy.S')

    MIGRATED_EXPERIMENT=$(cat <<EOF
{
    "experimentId": {"S": "$EXPERIMENT_ID"},
    "gsi1pk": {"S": "$EXPERIMENTS_GSI1PK"},
    "gsi1sk": {"S": "$EXPERIMENT_GSI1SK"},
    "expId": {"S": "$EXP_ID"},
    "siteId": {"S": "$SITE_ID"},
    "startDate": {"S": "$START_DATE"},
    "status": {"S": "$STATUS"},
    "type": {"S": "$TYPE"},
    "endDate": {"S": "$END_DATE"},
    "url": {"S": "$URL"},
    "variants": $VARIANTS,
    "name": {"S": "$NAME"},
    "conversionEventName": {"S": "$CONVERSION_EVENT_NAME"},
    "conversionEventValue": {"S": "$CONVERSION_EVENT_VALUE"},
    "pk": {"S": "$EXPERIMENT_PK"},
    "sk": {"S": "$EXPERIMENT_SK"},
    "__edb_e__": {"S": "Experiment"},
    "__edb_v__": {"N": "1"},
    "createdAt": {"S": "$CREATED_AT"},
    "updatedAt": {"S": "$UPDATED_AT"},
    "updatedBy": {"S": "$UPDATED_BY"}
}
EOF
)

    # Insert migrated experiment into the data table
    $AWS_LOCAL_CMD put-item --table-name $DATA_TABLE --item "$MIGRATED_EXPERIMENT"

done

echo "Migrated experiments successfully."

# Migrate each site candidate
echo "$SITE_CANDIDATES" | jq -c '.Items[]' | while read -r site_candidate; do
    echo "Migrating site candidate..."
    SITE_CANDIDATE_ID=$(uuidgen)
    SITE_CANDIDATE_PK="\$spacecat#sitecandidateId_$SITE_CANDIDATE_ID"
    SITE_CANDIDATE_SK="\$sitecandidate_1"
    SITE_ID=$(echo "$site_candidate" | jq -r '.siteId.S')
    BASE_URL=$(echo "$site_candidate" | jq -r '.baseURL.S')
    CREATED_AT=$(echo "$site_candidate" | jq -r '.createdAt.S')
    UPDATED_AT=$(echo "$site_candidate" | jq -r '.updatedAt.S')
    UPDATED_BY=$(echo "$site_candidate" | jq -r '.updatedBy.S')
    SOURCE=$(echo "$site_candidate" | jq -r '.source.S')
    HLX_CONFIG=$(echo "$site_candidate" | jq -r '.hlxConfig // {"M": {}}')
    STATUS=$(echo "$site_candidate" | jq -r '.status.S')
    SITE_CANDIDATE_GSI1PK="all_sitecandidates"
    SITE_CANDIDATE_GSI1SK="\$sitecandidate_1#baseurl_${BASE_URL}"
    SITE_CANDIDATE_GSI2PK="\$spacecat#siteid_$SITE_ID"
    SITE_CANDIDATE_GSI2SK="\$sitecandidate_1#updatedat_${UPDATED_AT}"

    MIGRATED_SITE_CANDIDATE=$(cat <<EOF
{
    "siteCandidateId": {"S": "$SITE_CANDIDATE_ID"},
    "gsi1pk": {"S": "$SITE_CANDIDATE_GSI1PK"},
    "gsi1sk": {"S": "$SITE_CANDIDATE_GSI1SK"},
    "gsi2pk": {"S": "$SITE_CANDIDATE_GSI2PK"},
    "gsi2sk": {"S": "$SITE_CANDIDATE_GSI2SK"},
    "siteId": {"S": "$SITE_ID"},
    "baseURL": {"S": "$BASE_URL"},
    "source": {"S": "$SOURCE"},
    "status": {"S": "$STATUS"},
    "hlxConfig": $HLX_CONFIG,
    "pk": {"S": "$SITE_CANDIDATE_PK"},
    "sk": {"S": "$SITE_CANDIDATE_SK"},
    "__edb_e__": {"S": "SiteCandidate"},
    "__edb_v__": {"N": "1"},
    "createdAt": {"S": "$CREATED_AT"},
    "updatedBy": {"S": "$UPDATED_BY"},
    "updatedAt": {"S": "$UPDATED_AT"}
}
EOF
)

    # Insert migrated site candidate into the data table
    $AWS_LOCAL_CMD put-item --table-name $DATA_TABLE --item "$MIGRATED_SITE_CANDIDATE"

done
echo "Migrated site candidates successfully."

# Migrate each top page
echo "$TOP_PAGES" | jq -c '.Items[]' | while read -r top_page; do
    TOP_PAGE_ID=$(uuidgen)
    SITE_ID=$(echo "$top_page" | jq -r '.siteId.S')
    GEOGRAPHY=$(echo "$top_page" | jq -r '.geo.S')
    IMPORTED_AT=$(echo "$top_page" | jq -r '.importedAt.S')
    SOURCE=$(echo "$top_page" | jq -r '.source.S')
    TOP_KEYWORD=$(echo "$top_page" | jq -r '.topKeyword.S')
    TRAFFIC=$(echo "$top_page" | jq -r '.traffic.N')
    URL=$(echo "$top_page" | jq -r '.url.S')
    CREATED_AT=$(echo "$top_page" | jq -r '.createdAt.S')
    UPDATED_AT=$(echo "$top_page" | jq -r '.updatedAt.S')
    CONFIG=$(echo "$top_page" | jq -r '.config // {"M": {}}')
    TOP_PAGE_PK="\$spacecat#sitetoppageId_$TOP_PAGE_ID"
    TOP_PAGE_SK="\$sitetoppage_1"
    TOP_PAGE_GSI1PK="\$spacecat#siteid_$SITE_ID"
    TOP_PAGE_GSI1SK="$TOP_PAGE_SK#source_${SOURCE}#geo_${GEOGRAPHY}#traffic_${TRAFFIC}"

    MIGRATED_TOP_PAGE=$(cat <<EOF
{
    "siteTopPageId": {"S": "$TOP_PAGE_ID"},
    "siteId": {"S": "$SITE_ID"},
    "geo": {"S": "$GEOGRAPHY"},
    "importedAt": {"S": "$IMPORTED_AT"},
    "source": {"S": "$SOURCE"},
    "topKeyword": {"S": "$TOP_KEYWORD"},
    "traffic": {"N": "$TRAFFIC"},
    "url": {"S": "$URL"},
    "gsi1pk": {"S": "$TOP_PAGE_GSI1PK"},
    "gsi1sk": {"S": "$TOP_PAGE_GSI1SK"},
    "pk": {"S": "$TOP_PAGE_PK"},
    "sk": {"S": "$TOP_PAGE_SK"},
    "__edb_e__": {"S": "SiteTopPage"},
    "__edb_v__": {"N": "1"},
    "createdAt": {"S": "$CREATED_AT"},
    "updatedAt": {"S": "$UPDATED_AT"},
    "config": $CONFIG
}
EOF
)

    # Insert migrated top page into the data table
    $AWS_LOCAL_CMD put-item --table-name $DATA_TABLE --item "$MIGRATED_TOP_PAGE"

done
echo "Migrated top pages successfully."

# Migrate each key event
echo "$KEY_EVENTS" | jq -c '.Items[]' | while read -r key_event; do
    KEY_EVENT_ID=$(uuidgen)
    SITE_ID=$(echo "$key_event" | jq -r '.siteId.S')
    NAME=$(echo "$key_event" | jq -r '.name.S')
    TYPE=$(echo "$key_event" | jq -r '.type.S')
    TIME=$(echo "$key_event" | jq -r '.time.S')
    CREATED_AT=$(echo "$key_event" | jq -r '.createdAt.S')
    UPDATED_AT=$(echo "$key_event" | jq -r '.updatedAt.S')
    KEY_EVENT_PK="\$spacecat#keyeventid_$KEY_EVENT_ID"
    KEY_EVENT_SK="\$keyevent_1"
    KEY_EVENT_GSI1PK="\$spacecat#siteid_$SITE_ID"
    KEY_EVENT_GSI1SK="$KEY_EVENT_SK#time_${TIME}"

    MIGRATED_KEY_EVENT=$(cat <<EOF
{
    "keyEventId": {"S": "$KEY_EVENT_ID"},
    "gsi1pk": {"S": "$KEY_EVENT_GSI1PK"},
    "gsi1sk": {"S": "$KEY_EVENT_GSI1SK"},
    "siteId": {"S": "$SITE_ID"},
    "name": {"S": "$NAME"},
    "type": {"S": "$TYPE"},
    "time": {"S": "$TIME"},
    "pk": {"S": "$KEY_EVENT_PK"},
    "sk": {"S": "$KEY_EVENT_SK"},
    "__edb_e__": {"S": "KeyEvent"},
    "__edb_v__": {"N": "1"},
    "createdAt": {"S": "$CREATED_AT"},
    "updatedAt": {"S": "$UPDATED_AT"}
}
EOF
)

    # Insert migrated key event into the data table
    $AWS_LOCAL_CMD put-item --table-name $DATA_TABLE --item "$MIGRATED_KEY_EVENT"

done
echo "Migrated key events successfully."

echo "Migration completed successfully."
