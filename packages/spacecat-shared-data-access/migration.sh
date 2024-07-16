#!/bin/bash

# Define AWS CLI command with local DynamoDB endpoint
AWS_CMD="aws dynamodb --endpoint-url http://localhost:8000"
REGION="us-west-2"

# Define table names
SITE_TABLE="spacecat-services-sites"
ORGANIZATION_TABLE="spacecat-services-organizations"

# Fetch all sites
SITES=$($AWS_CMD scan --table-name $SITE_TABLE)
ORGANIZATIONS=$($AWS_CMD scan --table-name $ORGANIZATION_TABLE)

# Migrate each site
echo "$SITES" | jq -c '.Items[]' | while read -r site; do
    SITE_ID=$(echo $site | jq -r '.id.S')
    BASE_URL=$(echo $site | jq -r '.baseURL.S')
    DELIVERY_TYPE=$(echo $site | jq -r '.deliveryType.S')
    GITHUB_URL=$(echo $site | jq -r '.gitHubURL.S')
    ORG_ID=$(echo $site | jq -r '.organizationId.S')
    IS_LIVE=$(echo $site | jq -r '.isLive.BOOL // false')
    IS_LIVE_TOGGLED_AT=$(echo $site | jq -r '.isLiveToggledAt.S // empty')
    GSI1PK=$(echo $site | jq -r '.GSI1PK.S')
    CREATED_AT=$(echo $site | jq -r '.createdAt.S')
    UPDATED_AT=$(echo $site | jq -r '.updatedAt.S')
    SLACK_WORKSPACE=$(echo $site | jq -r '.config.M.slack.M.workspace.S // empty')
    SLACK_CHANNEL=$(echo $site | jq -r '.config.M.slack.M.channel.S // empty')
    MENTIONS_SLACK=$(echo $site | jq -r '.config.M.alerts.L[0].M.mentions.L[0].M.slack.L[0].S // empty')
    EXCLUDED_URLS=$(echo $site | jq -r '.auditConfig.M.auditTypeConfigs.M["lhs-mobile"].M.excludedURLs.L[0].S // empty')

    MIGRATED_SITE=$(cat <<EOF
{
    "id": {"S": "$SITE_ID"},
    "baseURL": {"S": "$BASE_URL"},
    "deliveryType": {"S": "$DELIVERY_TYPE"},
    "gitHubURL": {"S": "$GITHUB_URL"},
    "organizationId": {"S": "$ORG_ID"},
    "isLive": {"BOOL": $IS_LIVE},
    "isLiveToggledAt": {"S": "$IS_LIVE_TOGGLED_AT"},
    "GSI1PK": {"S": "$GSI1PK"},
    "createdAt": {"S": "$CREATED_AT"},
    "updatedAt": {"S": "$UPDATED_AT"},
    "config": {
        "M": {
            "slack": {"M": {"workspace": {"S": "$SLACK_WORKSPACE"}, "channel": {"S": "$SLACK_CHANNEL"}}},
            "handlers": {
                "M": {
                    "404": {"M": {"mentions": {"M": {"slack": {"L": [{"S": "$MENTIONS_SLACK"}]}}}}},
                    "broken-backlinks": {"M": {"excludedURLs": {"L": [{"S": "$EXCLUDED_URLS"}]}}}
                }
            }
        }
    }
}
EOF
)

    # Insert migrated site data into the site table
    $AWS_CMD put-item --table-name $SITE_TABLE --item "$MIGRATED_SITE"
done

# Migrate each organization
echo "$ORGANIZATIONS" | jq -c '.Items[]' | while read -r org; do
    ORG_ID=$(echo $org | jq -r '.id.S')
    IMS_ORG_ID=$(echo $org | jq -r '.imsOrgId.S')
    NAME=$(echo $org | jq -r '.name.S')
    GSI1PK=$(echo $org | jq -r '.GSI1PK.S')
    CREATED_AT=$(echo $org | jq -r '.createdAt.S')
    UPDATED_AT=$(echo $org | jq -r '.updatedAt.S')
    SLACK_WORKSPACE=$(echo $org | jq -r '.config.M.slack.M.workspace.S // empty')
    SLACK_CHANNEL=$(echo $org | jq -r '.config.M.slack.M.channel.S // empty')
    ALERT_TYPE=$(echo $org | jq -r '.config.M.alerts.L[0].M.type.S // empty')
    ALERT_COUNTRY=$(echo $org | jq -r '.config.M.alerts.L[1].M.country.S // empty')

    MIGRATED_ORG=$(cat <<EOF
{
    "id": {"S": "$ORG_ID"},
    "imsOrgId": {"S": "$IMS_ORG_ID"},
    "name": {"S": "$NAME"},
    "GSI1PK": {"S": "$GSI1PK"},
    "createdAt": {"S": "$CREATED_AT"},
    "updatedAt": {"S": "$UPDATED_AT"},
    "config": {
        "M": {
            "slack": {"M": {"workspace": {"S": "$SLACK_WORKSPACE"}, "channel": {"S": "$SLACK_CHANNEL"}}},
            "handlers": {
                "M": {
                    "404": {"M": {"enabledByDefault": {"BOOL": true}}},
                    "$ALERT_TYPE": {"M": {"enabledByDefault": {"BOOL": false}, "country": {"S": "$ALERT_COUNTRY"}}}
                }
            }
        }
    }
}
EOF
)

    # Insert migrated organization data into the organization table
    $AWS_CMD put-item --table-name $ORGANIZATION_TABLE --item "$MIGRATED_ORG"
done

echo "Migration completed successfully."
