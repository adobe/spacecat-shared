#!/bin/bash

# Define AWS CLI command with local DynamoDB endpoint
AWS_CMD="aws dynamodb --endpoint-url http://localhost:8000"
REGION="us-west-2"

# Define table names
SITE_TABLE="spacecat-services-sites"
ORGANIZATION_TABLE="spacecat-services-organizations"

# Fetch all sites
SITES=$($AWS_CMD scan --table-name $SITE_TABLE --region $REGION)
ORGANIZATIONS=$($AWS_CMD scan --table-name $ORGANIZATION_TABLE --region $REGION)

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

    # Extract audit configurations
    AUDIT_CONFIGS=$(echo $site | jq -c '.auditConfig.M.auditTypeConfigs.M')
    HANDLERS=$(echo "$AUDIT_CONFIGS" | jq 'keys' | jq -c '.[]' | while read -r key; do
        MENTIONS=$(echo "$AUDIT_CONFIGS" | jq -c --arg key "$key" '.[$key].M.mentions.L // empty')
        EXCLUDED_URLS=$(echo "$AUDIT_CONFIGS" | jq -c --arg key "$key" '.[$key].M.excludedURLs.L // empty')
        MANUAL_OVERWRITES=$(echo "$AUDIT_CONFIGS" | jq -c --arg key "$key" '.[$key].M.manualOverwrites.L // empty')
        FIXED_URLS=$(echo "$AUDIT_CONFIGS" | jq -c --arg key "$key" '.[$key].M.fixedURLs.L // empty')

        if [ "$key" == "\"broken-backlinks\"" ]; then
            cat <<EOF
"$key": {
    "M": {
        "mentions": {"L": $MENTIONS},
        "excludedURLs": {"L": $EXCLUDED_URLS},
        "manualOverwrites": {"L": $MANUAL_OVERWRITES},
        "fixedURLs": {"L": $FIXED_URLS}
    }
}
EOF
        else
            cat <<EOF
"$key": {
    "M": {
        "mentions": {"L": $MENTIONS}
    }
}
EOF
        fi
    done | jq -s 'add')

    if [ -n "$SLACK_WORKSPACE" ] && [ -n "$SLACK_CHANNEL" ]; then
        SLACK_CONFIG=$(cat <<EOF
"slack": {"M": {"workspace": {"S": "$SLACK_WORKSPACE"}, "channel": {"S": "$SLACK_CHANNEL"}}}
EOF
)
    else
        SLACK_CONFIG=$(cat <<EOF
"slack": {"M": {}}
EOF
)
    fi

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
            $SLACK_CONFIG,
            "handlers": {"M": $HANDLERS}
        }
    }
}
EOF
)

    # Insert migrated site data into the site table
    $AWS_CMD put-item --table-name $
