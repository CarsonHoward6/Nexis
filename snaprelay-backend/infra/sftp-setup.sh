#!/usr/bin/env bash
set -euo pipefail
# Idempotent: creates the Transfer Family SFTP server + IAM role once,
# leaves it STOPPED (no $ until you run sftp-on.sh).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
if [ -f "$ENV_FILE" ]; then set -a; source "$ENV_FILE"; set +a; fi

: "${AWS_REGION:?}"; : "${AWS_ACCOUNT_ID:?}"; : "${S3_BUCKET:?}"

ROLE_NAME="snaprelay-sftp-role"
SERVER_TAG_KEY="Project"
SERVER_TAG_VAL="snaprelay"

# 1. role
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "[create] role $ROLE_NAME"
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://$ROOT/infra/sftp-trust.json" >/dev/null
fi
aws iam put-role-policy --role-name "$ROLE_NAME" \
  --policy-name snaprelay-sftp-inline \
  --policy-document "file://$ROOT/infra/sftp-role.json"
ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"

# 2. server
SERVER_ID="$(aws transfer list-servers --region "$AWS_REGION" \
  --query "Servers[?Tags && Tags[?Key=='$SERVER_TAG_KEY' && Value=='$SERVER_TAG_VAL']].ServerId | [0]" \
  --output text 2>/dev/null || echo None)"
if [ -z "$SERVER_ID" ] || [ "$SERVER_ID" = "None" ]; then
  # older CLIs don't support the tag-query filter on list-servers; fall back to tag-by-tag
  SERVER_ID="$(aws transfer list-servers --region "$AWS_REGION" --query 'Servers[].ServerId' --output text \
    | tr '\t' '\n' | while read -r id; do
        tag="$(aws transfer list-tags-for-resource --arn "arn:aws:transfer:${AWS_REGION}:${AWS_ACCOUNT_ID}:server/${id}" \
          --region "$AWS_REGION" --query "Tags[?Key=='$SERVER_TAG_KEY' && Value=='$SERVER_TAG_VAL'] | [0].Value" --output text 2>/dev/null || echo None)"
        if [ "$tag" = "$SERVER_TAG_VAL" ]; then echo "$id"; break; fi
      done)"
fi

if [ -z "$SERVER_ID" ] || [ "$SERVER_ID" = "None" ]; then
  echo "[create] SFTP server"
  SERVER_ID="$(aws transfer create-server \
    --protocols SFTP \
    --identity-provider-type SERVICE_MANAGED \
    --endpoint-type PUBLIC \
    --domain S3 \
    --tags Key=$SERVER_TAG_KEY,Value=$SERVER_TAG_VAL \
    --region "$AWS_REGION" \
    --query ServerId --output text)"
else
  echo "[exists] SFTP server $SERVER_ID"
fi

# 3. stop by default (cost saver)
STATE="$(aws transfer describe-server --server-id "$SERVER_ID" --region "$AWS_REGION" --query 'Server.State' --output text)"
if [ "$STATE" = "ONLINE" ]; then
  echo "Server is ONLINE. Use sftp-off.sh to stop billing when done."
else
  echo "Server is $STATE (not billing). Use sftp-on.sh before a demo."
fi

echo ""
echo "ServerId: $SERVER_ID"
echo "Endpoint (when online): ${SERVER_ID}.server.transfer.${AWS_REGION}.amazonaws.com"
echo "Role ARN: $ROLE_ARN"
echo ""
echo "Save these for sftp-add-user.sh:"
echo "  SFTP_SERVER_ID=$SERVER_ID"
echo "  SFTP_ROLE_ARN=$ROLE_ARN"
