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

# Fetch all sites
SITES=$($AWS_CMD scan --table-name $SITE_TABLE)
ORGANIZATIONS=$($AWS_CMD scan --table-name $ORGANIZATION_TABLE)
CONFIGURATIONS=$($AWS_CMD scan --table-name $CONFIGURATION_TABLE)

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
    "gsi1pk": {"S": "$GSI1PK"},
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

    # Insert migrated organization data into the organization table
    $AWS_LOCAL_CMD put-item --table-name $DATA_TABLE --item "$MIGRATED_ORG"

done
#TODO Migrate each configuration, top page, etc
echo "Migration completed successfully."
